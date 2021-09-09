'use strict';

$(() => {
    let interval = setInterval(() => {
        if($('.header').length != 0) {
            clearInterval(interval);
            init();
        }
    }, 200);
});

let notoEditor;

function init() {
    let $topNotoTitle = $('#TopNotoTitle');
    $topNotoTitle.on('input', onTopNoteTitleInput);

    let $notoAddBtn = $('#NotoAddBtn');
    $notoAddBtn.on('click', onNotoAddBtnClick);

    let $mainEditor = $('#MainEditor');
    $mainEditor.html('<div>Text</div>');
    $mainEditor.focus();
    // event.data が undefined になるため on を使わない; 原因不明
    $mainEditor[0].addEventListener('input', onMainEditorInput);
    $mainEditor[0].addEventListener('paste', onEditorPaste);

    let editorObserver = new MutationObserver(onMainEditorMutate);

    editorObserver.observe($mainEditor[0], {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    });

    $(document).on('keydown', onKeyDown);

    notoEditor = new NotoEditor();
    notoEditor.initNotoData(() => {
        console.log(notoEditor);
    });
}

function onTopNoteTitleInput(event) {
    let newTitle = $(event.target).val();
    notoEditor.setFocusedNotoTitle(newTitle);
}

function onNotoAddBtnClick(_event) {
    notoEditor.addNewNoto();
}

function onMainEditorInput(event) {
    // if(event.data == ' ') {
    //     $.each($('#MainEditor div'), (_index, elem) => {
    //         let $elem = $(elem);

    //         if($elem.text().startsWith('##')) {
    //             $elem.addClass('title-2');
    //             $elem.text($elem.text().substring(2));
    //         }
    //     });
    // }
}

function onMainEditorMutate(event) {
    $.each(event, (_index, record) => {
        $.each(record.addedNodes, onMainEditorElemAdd);
    });
}

function onMainEditorElemAdd(_index, node) {
    let $elem = $(node);

    if($elem.data('keepClass') != 'true') {
        $elem.removeAttr('class');
        $elem.children().removeAttr('class');
    }

    let index = $elem.index();
    let indent = '0px';

    if(index != -1) {
        indent = $elem.parent().children().eq(index - 1).css('text-indent');
    }

    $elem.removeAttr('style');
    $elem.children().removeAttr('style');

    if($elem.data('invalidateIndent') != 'true') {
        $elem.css('text-indent', indent);
    }

    switch($elem[0].tagName) {
        case 'B':
        $elem.addClass('bold');
        break;

        case 'I':
        $elem.addClass('italic');
        break;

        case 'LI':
        $elem.addClass('list-item');
        break;

        case 'S':
        $elem.addClass('strike');
        break;

        case 'U':
        $elem.addClass('underline');
        break;
    }

    if($elem.text().startsWith('##')) {
        $elem.addClass('title-2');
        $elem.text($elem.text().substring(2));
    }
}

function onEditorPaste(event) {
    // event.preventDefault();
    // console.log(event.clipboardData.setData('Text', event.clipboardData.getData('Text')));
}

function onKeyDown(event) {
    if($(':focus').attr('id') === 'MainEditor') {
        if(event.key === ' ') {
            // note: スペース入力によるタイトルやリストの生成

            $.each($('#MainEditor div'), (_index, elem) => {
                let $elem = $(elem);

                if($elem.html().startsWith('##')) {
                    let titleNum = 2;

                    for(; titleNum < $elem.html().length; titleNum += 1) {
                        if($elem.html()[titleNum] != '#') {
                            break;
                        }
                    }

                    if(titleNum > 4) {
                        return;
                    }

                    let text = $elem.html().substring(titleNum);

                    if(text.length == 0) {
                        $elem.html('<br>' + text);
                    } else {
                        $elem.html(text);
                    }

                    $elem.removeAttr('class');
                    $elem.addClass('title-' + String(titleNum));
                    event.preventDefault();
                    return;
                }

                if($elem.text().startsWith('-')) {
                    let $listItem = $('<li class="list-item"></li>');
                    $listItem.addClass('list-item');
                    $listItem.data('keepClass', 'true');
                    $listItem.text($elem.text().substring(1));
                    $elem.replaceWith($listItem);

                    event.preventDefault();
                    return;
                }
            });

            return;
        }

        let selectionRange = window.getSelection().getRangeAt(0);
        let $target = $(selectionRange.startContainer);

        if(selectionRange.startContainer.constructor.name == 'Text') {
            $target = $(selectionRange.startContainer.parentElement);
        }

        if(event.key === 'Backspace') {
            if(!selectionRange.collapsed || selectionRange.startOffset != 0) {
                return;
            }

            let indent = $target.css('text-indent');
            indent = Number(indent.substring(0, indent.length - 2));

            if(indent > 0) {
                if(indent >= 20) {
                    $target.css('text-indent', (indent - 20) + 'px');
                } else {
                    $target.css('text-indent', '0px');
                }

                if($target.css('text-indent') == '0px') {
                    $target.data('invalidateIndent', 'true');
                }

                event.preventDefault();
                return;
            }

            if($target.hasClass('list-item')) {
                let $newElem = $('<div></div>');

                if($target.html().length == 0) {
                    $newElem.html('<br>' + $target.html());
                } else {
                    $newElem.html($target.html());
                }

                if($target.data('invalidateIndent') == 'true') {
                    $newElem.data('invalidateIndent', 'true');
                }

                $target.replaceWith($newElem);
                event.preventDefault();
                return;
            }
        }

        if(event.key === 'Tab') {
            let indent = $target.css('text-indent');
            indent = Number(indent.substring(0, indent.length - 2));
            $target.css('text-indent', (indent + 20) + 'px');
            event.preventDefault();
            return;
        }
    }
}

function isNumInRange(num, begin, end) {
    return num < begin && num > end;
}

class NotoError extends Error {
    constructor(msg) {
        super();
        this.msg = msg;
    }
}

class NotoEditor {
    constructor() {
        this.notos = {};
        this.focusedNotoID = '';
        this.tabNotoIDs = [];
    }

    initNotoData(onSucceed) {
        getAllIDBData((notos) => {
            notos.forEach((eachNoto) => {
                this.addNoto(new Noto(eachNoto.id, eachNoto.tags, eachNoto.title, eachNoto.content));
            });

            onSucceed();
        });
    }

    addNoto(noto) {
        if(this.existsNoto(noto.id)) {
            throw new NotoError(`New Noto ID '${noto.id}' is duplicated.`);
        }

        this.notos[noto.id] = noto;

        let $listItem = $(`<div class="noto" id="LeftNotoListItem_${noto.id}"><div class="title">${noto.title}</div><div class="text">${noto.content}</div></div>`);

        $listItem.on('click', (_event) => {
            let listItemIDPrefix = 'LeftNotoListItem_';
            let listItemID = $listItem.attr('id');

            if(!listItemID.startsWith(listItemIDPrefix)) {
                return;
            }

            let notoID = listItemID.substring(listItemIDPrefix.length);
            this.openNoto(notoID);
        });

        $('#LeftNotoList').append($listItem);
    }

    addNewNoto() {
        let newID = this.generateNotoID();

        if(this.existsNoto(newID)) {
            throw new NotoError(`New Noto ID '${newID}' is duplicated.`);
        }

        let newTitle = 'New Noto';
        let newContent = 'Edit here.';

        this.addNoto(new Noto(newID, [], newTitle, newContent));
        this.openNoto(newID);
    }

    getNoto(notoID) {
        let noto = this.notos[notoID];

        if(!this.existsNoto(notoID)) {
            throw new NotoError(`Noto ID '${notoID}' is unknown.`);
        }

        return noto;
    }

    existsNoto(notoID) {
        // 無限ループを防ぐため getNoto() を使用しない
        return this.notos[notoID] !== undefined;
    }

    openNoto(notoID) {
        let idIndex = this.tabNotoIDs.indexOf(notoID);

        // すでに開いている場合はタブに追加せず順変更とフォーカスのみする
        if(idIndex !== -1) {
            this.tabNotoIDs.splice(idIndex, 1);
            this.tabNotoIDs.unshift(notoID);
            this.focusOnNoto(notoID);
            return;
        }

        this.tabNotoIDs.push(notoID);
        let noto = this.getNoto(notoID);

        let $newTabItem = $(`<div class="tab" id="TopTabItem_${notoID}"><div class="text">${noto.title}</div><div class="close"></div></div>`);
        $newTabItem.children('.close').on('click', (event) => {
            let itemID = $(event.target).parent().attr('id');
            let itemIDPrefix = 'TopTabItem_';

            if(!itemID.startsWith(itemIDPrefix)) {
                return;
            }

            let notoID = itemID.substring(itemIDPrefix.length);
            this.closeNoto(notoID);
        });

        $('#TopTabList').append($newTabItem);
        $('#TopNotoTitle').css('visibility', 'visible');
        this.focusOnNoto(notoID);
    }

    closeNoto(notoID) {
        // ノートが開いていなければ無視
        if(!this.tabNotoIDs.includes(notoID)) {
            return;
        }

        $(`#TopTabItem_${notoID}`).remove();
        let oldNotoIDIndex = this.tabNotoIDs.indexOf(notoID);
        this.tabNotoIDs.splice(oldNotoIDIndex, 1);
        this.focusOnLatestNoto();

        if(this.tabNotoIDs.length == 0) {
            $('#TopNotoTitle').css('visibility', 'hidden');
        }
    }

    focusOnNoto(notoID) {
        let noto = this.getNoto(notoID);
        this.focusedNotoID = notoID;
        $('#TopNotoTitle').val(noto.title);
    }

    focusOnLatestNoto() {
        let latestID = this.tabNotoIDs[this.tabNotoIDs.length - 1];

        // 開いているノートがなければ無視
        if(latestID === undefined) {
            this.focusedNotoID = '';
            return;
        }

        this.focusOnNoto(latestID);
    }

    saveNoto(notoID, onSucceed) {
        let noto = this.getNoto(notoID);

        putIDBData(noto, () => {
            onSucceed();
        });
    }

    generateNotoID() {
        let raw = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let len = 16;
        return Array.from(Array(len)).map(() => raw[Math.floor(Math.random() * raw.length)]).join('');
    }

    saveFocusedNoto() {
        this.saveNoto(this.focusedNotoID);
    }

    updateFocusedNotoDisplay() {
        let noto = this.getNoto(this.focusedNotoID);

        // #TopNotoTitle の変更は行わない
        let tabItem = $(`#TopTabItem_${this.focusedNotoID}`);
        tabItem.children('.text').text(noto.title);

        let listItem = $(`#LeftNotoListItem_${this.focusedNotoID}`);
        listItem.children('.title').text(noto.title);
        listItem.children('.text').text(noto.content);
    }

    setFocusedNotoTitle(newTitle) {
        if(this.focusedNotoID == '') {
            return;
        }

        this.getNoto(this.focusedNotoID).title = newTitle;
        this.updateFocusedNotoDisplay();
    }

    updateFocusedNotoContent() {
        let $editor = $('#MainEditor');

        function formatContent(content) {
            let $content = $(content);
            let $children = $content.children();

            a(undefined, $content);
            $.each($children, a);

            function a(_index, elem) {
                let $elem = $(elem);
                // let backColor = $elem.css('background-color');
                // let fontColor = $elem.css('color');
                // let fontSize = parseInt($elem.css('font-size'));

                // $elem.css('font-family', '');
                // $elem.css('background-color', '');
                // $elem.css('color', '');

                // if(fontSize != 18) {
                //     if(fontSize < 18) {
                //         $elem.css('font-size', 18);
                //     } else if(isNumInRange(fontSize, 18, 24)) {
                //         console.log('fontSize');
                //         $elem.css('font-size', 24);
                //     } else {
                //         $elem.css('font-size', 24);
                //     }
                // }

                // switch($elem[0].tagName) {
                //     case 'I': {
                //         console.log('i');
                //     } break;
                // }

                console.log($elem.attr('style'));
                if($elem.attr('style') === undefined) {
                    return;
                }

                let $newElem = $('<span></span>');
                let replace = false;

                if($elem.css('font-weight') == 700 && !$elem.hasClass('bold')) {
                    $newElem.addClass('bold');
                    replace = true;
                }

                console.log($elem.css('font-style'))
                if($elem.css('font-style').startsWith('italic') && !$elem.hasClass('italic')) {
                    $newElem.addClass('italic');
                    replace = true;
                }

                $elem.removeAttr('style');

                if(replace) {
                    $newElem.html($elem.html());
                    console.log($newElem.attr('style'));
                    $elem.replaceWith($newElem);
                }

                formatContent(elem);
            }
        }

        formatContent($editor);
    }
}

class Noto {
    constructor(id, tags, title, content) {
        this.id = id;
        this.tags = tags;
        this.title = title;
        this.content = content;
    }
};
