const { remote, ipcRenderer } = require('electron');
const $ = require('jquery');
const fs = require('fs');
const { error } = require('jquery');
const app = remote.app;

const DEFAULT_WIDGETS_CHARA_PATH = '..\\img\\widgetsChars.png';
var RESOURCE_PACK_PATH;

const selectDirBtn = document.getElementById('selectResourcePack');
selectDirBtn.addEventListener('click', () => {
    ipcRenderer.send('open-resourcepack-dialog');
});

ipcRenderer.on('selected-directory', async (event, path) => {
    resetOverwriteCheck();
    resetError();
    resetWarning();
    resetPackPng();
    RESOURCE_PACK_PATH = path
    if (isConvertibleResourcePack()) {
        resourcePackSelectedInProcess();
    } else {
        console.log('加工不可なresource pack が選択されました');
        var errorCode;
        if (isResourcePack() == false) {
            errorCode = 1;
        } else if (isWidgetsbaseExists() || isWidgetsbaseExists() == false) {
            errorCode = 2;
        }
        resourcePackExceptSelectedInProcess(errorCode);
    }
});

// select resource pack でリソースパックが選ばれた場合の処理
function resourcePackSelectedInProcess() {
    console.log('加工可能なresource pack が選択されました');
    setWidgetBasePath()
    setWidgetCharsPath();
    // overwrite widgets.png のチェック
    setOutputPath();
    // game directory input の設定
    setOptionPath();
    // pack.pngの設定
    setPackPng();
}

function setWidgetBasePath() {
    // widgetBase exits
    if (isWidgetsExists()) {
        console.log('widgets発見');
        $('#overwriteWidgets').removeAttr("disabled");
    }
    if (isWidgetsbaseExists()) {
        $('#widgetsBasePathInput').val(getWidgetsBasePath());
    } else {
        $('#baseWarning').text($('#baseWarning').text() + 'widgetsBase.pngが見つかりませんでした。widgets.pngを代わりに使用します')
        $('#widgetsBasePathInput').val(getWidgetsPath());
    }
}

function setWidgetCharsPath() {
    // widgetChars exits
    if (isWidgetsCharsExists()) {
        $('#widgetsCharsPathInput').val(getWidgetsCharsPath());
    } else {
        $('#charsWarning').text($('#charsWarning').text() + 'widgetsChars.pngが見つかりませんでした。App付属のwidgetsChars.pngを使用します')
        $('#widgetsCharsPathInput').val(DEFAULT_WIDGETS_CHARA_PATH);
    }
}

function setOutputPath() {
    if ($('#overwriteWidgets').prop('checked')) {
        setOutputPathOverwrite();
    } else {
        setOutputPathDoNotOverwrite();
    }
}

function setOutputPathDoNotOverwrite() {
    $('#outputPathInput').val(getOutputDirPath() + 'widgetsOutput.png');
}

function setOutputPathOverwrite() {
    $('#outputPathInput').val(getOutputDirPath() + 'widgets.png');
}

function setPackPng() {
    if (fs.existsSync(RESOURCE_PACK_PATH + '\\pack.png')) {
        $('#packPng').attr('src', RESOURCE_PACK_PATH + '\\pack.png');
    } else {
        $('#packPng').attr('src', '../img/pack.png');
    }
}

function resetPackPng() {
    $('#packPng').attr('src', '../img/pack.png');
}

$('#overwriteWidgets').change(() => {
    setOutputPath();
});


function setOptionPath() {
    var gameDirPath;
    console.log(RESOURCE_PACK_PATH && fs.existsSync(getDirName(RESOURCE_PACK_PATH, 2)));
    if (RESOURCE_PACK_PATH && fs.existsSync(getDirName(RESOURCE_PACK_PATH, 2))) {
        gameDirPath = getDirName(RESOURCE_PACK_PATH, 2);
    } else {
        gameDirPath = app.getPath('appData') + '\\.minecraft'
    }
    setOptionDataPreprocess(getOptionPathByArg(gameDirPath));
}

function setOptionDataPreprocess(path) {
    if (fs.existsSync(path)) {
        $('#gameOptionInput').val(path);
        setOptionData();
    } else {
        gameDirNotFound();
    }
}

function gameDirNotFound() {
    $('#gameOptionError')
        .text('ゲームディレクトリが見つかりませんでした。minecraftのゲームディレクトリにあるoptions.txtを指定してください');
}

// option data table 関係を設定する
function setOptionData() {
    // optionから改行区切りで配列にしたものをlineDataListに格納
    var options = new Map();
    var text = fs.readFileSync(getOptionPath()).toString();
    var lineDataList = text.split(getLFCode(text));
    lineDataList.forEach((text) => {
        //console.log(text);
        // version取得&描画
        if (text.toString().split(":")[0] == 'version') {
            setMinecraftVersion(getMinecraftVersionString(text.toString().split(":")[1]));
            if(getMinecraftVersionString(text.toString().split(":")[1]) == 'none'){
                SelectedOutOfSupportVersion();
            }
        }
        if (text.toString().split(":")[0].match(/key_key\.hotbar.*/g) /*|| text.toString().split(":")[0].match(/key_key.swapOffhand/g)*/) {
            options.set(text.toString().split(":")[0], text.toString().split(":")[1]);
        }
    });
    setKeyConfig(options, getMinecraftVersionString(text.toString().split(":")[1]));
    console.log(options);
}

//codeからminecraftのversionを返す(参照:https://minecraft.fandom.com/wiki/Data_version)
function getMinecraftVersionString(code) {
    var v;
    console.log(code );
    switch (code) {
        case '2586':
            v = '1.16.5'
            break;
        default:
            v = 'none';
            break;
    }
    return v;
}

function setMinecraftVersion(text){
    $('#minecraftVersion').text(text);
}

// options{"keyConfig":"value"}をもとに'#minecraftKeyConfig'をいれる
function setKeyConfig(options,version) {
    var keyConfig;
    var array = new Array();
    options.forEach(element => {
        array.push(element);
    });
    //console.log(ToStringFromKeyConfig(options,'1.16.5'));
    $('#minecraftKeyConfig').text(ToStringFromKeyConfig(options,version));
}

//optionsを変換して返す
function ToStringFromKeyConfig(options,version) {
    var stringArr = new Array();
    switch (version) {
        case '1.16.5':
            var keycode = getKeyCode1_16_5()
            options.forEach(option=>{
                console.log(option);
                stringArr.push(keycode[option]);
            });
            break;
        default:
            SelectedOutOfSupportVersion();
            break;
    }
    return stringArr.join(',');
}

//keycode1.16.5.jsonの内容を返す
function getKeyCode1_16_5() {
    return JSON.parse(fs.readFileSync('./keycode/keycode1.16.5.json'));
}

// 渡されたgame directoryのパスをもとにoptions.txtを返す
function getOptionPathByArg(path) {
    console.log(`${path}\\options.txt`);
    return `${path}\\options.txt`;
}

// 渡されたリソースパックのパスをもとにoptions.txtを返す
function getOptionPath() {
    if ($('#gameOptionInput').val()) {
        return $('#gameOptionInput').val();
    }
    else {
        throw error();
    }
}

// select resource pack でリソースパック以外が選ばれた場合の処理
function resourcePackExceptSelectedInProcess(errorCode) {
    switch (errorCode) {
        // リソースパック以外が選択された場合
        case 1:
            $('#errorMessage').text('minecraftのresource packを入れてください');
            break;
        // 選択されたリソースパックにwidgets.png,widgetsBase.pngがなかった場合
        case 2:
            $('#errorMessage').text('widgets.pngまたはwidgetsBase.pngが存在しないリソースパックは変換できません');
            break;
    }
}
// resource packかどうか(ディレクトリの中にmcmetaがあるかどうか)
function isResourcePack() {
    var fs = require('fs');
    var files = fs.readdirSync(RESOURCE_PACK_PATH)
    var ans = false;
    files.forEach(file => {
        //console.log(file);
        if (file.split('.')[1] == 'mcmeta') {
            ans = true;
        }
    });
    //console.log(`ans:${ans}`);
    return ans;
}
// 加工可能なリソースパックか
function isConvertibleResourcePack() {
    return isResourcePack() && (isWidgetsbaseExists() || isWidgetsExists());
}
// リソースパックにwidgets.pngがあるか
function isWidgetsExists() {
    return fs.existsSync(getWidgetsPath());
}
// リソースパックにwidgetsBase.pngがあるか
function isWidgetsbaseExists() {
    return fs.existsSync(getWidgetsBasePath());
}
// リソースパックにwidgetsChars.pngがあるか
function isWidgetsCharsExists() {
    return fs.existsSync(getWidgetsCharsPath());
}
// get path to widgetsBase.png
function getWidgetsPath() {
    return (RESOURCE_PACK_PATH + '\\assets\\minecraft\\textures\\gui\\widgets.png');
}
// get path to widgetsBase.png
function getWidgetsBasePath() {
    return (RESOURCE_PACK_PATH + '\\assets\\minecraft\\textures\\gui\\widgetsBase.png');
}
// get path to widgetsChars.png
function getWidgetsCharsPath() {
    return (RESOURCE_PACK_PATH + '\\assets\\minecraft\\textures\\gui\\widgetsChars.png');
}
//get path to output directory
function getOutputDirPath() {
    return (RESOURCE_PACK_PATH + '\\assets\\minecraft\\textures\\gui\\');
}

function resetError() {
    $('#errorMessage').text('');
    $('#baseError').text('');
    $('#charsError').text('');
    $('#outputError').text('');
    $('#gameOptionError').text('');
}

function resetWarning() {
    $('#warningMessage').text('');
    $('#baseWarning').text('');
    $('#charsWarning').text('');
    $('#outputWarning').text('');
    $('#gameOptionWarning').text('');
}

function resetOverwriteCheck() {
    $('#overwriteWidgets').attr('disabled', 'disabled')
}

function SelectedOutOfSupportVersion() {
    $('#gameOptionWarning').text('未対応のバージョンのoptionが選ばれました');
}
