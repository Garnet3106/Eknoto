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
    $mainEditor[0].addEventListener('compositionend', onCompositionEnd);
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
    let $mainEditor = $(event.target);

    if(event.inputType == 'insertText' && $mainEditor.children().length == 0) {
        addFirstElem($mainEditor);
    }
}

function onCompositionEnd(event) {
    let $target = $(event.target);

    if($target.attr('id') != 'MainEditor') {
        return;
    }

    if($target.children().length == 0) {
        addFirstElem($target);
    }
}

function addFirstElem($elem) {
    let $newElem = $('<div></div>');
    $newElem.html($elem.html());
    $elem.html('');
    $elem.append($newElem);

    let selection = window.getSelection();
    selection.removeAllRanges();

    let newRange = document.createRange();
    newRange.setStart($elem[0], 1);
    newRange.setEnd($elem[0], 1);
    selection.addRange(newRange);
}

function onMainEditorMutate(event) {
    $.each(event, (_index, record) => {
        $.each(record.addedNodes, onMainEditorElemAdd);
    });
}

function onMainEditorElemAdd(_index, node) {
    let $elem = $(node);

    if($elem.data('keepClass') !== 'true') {
        $elem.removeAttr('class');
        $elem.children().removeAttr('class');
    }

    if($elem.data('validateList') == 'true') {
        $elem.addClass('list-item');
        $elem.removeData('validateList');
    }

    switch($elem[0].tagName) {
        case 'B':
        $elem.addClass('bold');
        break;

        case 'DIV': {
            // インデント設定
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

            // // 前の要素を置き換え
            // let replacePreviousElemWith = $elem.data('replacePreviousElemWith');

            // console.log(replacePreviousElemWith);
            // if(replacePreviousElemWith !== undefined && index > 0) {
            //     let $replaceTarget = $elem.parent().children().eq(index - 1);
            //     let $newElem = $(replacePreviousElemWith);
            //     $replaceTarget.replaceWith($newElem);
            // }
        } break;

        case 'I':
        $elem.addClass('italic');
        break;

        case 'LI':
        $elem.addClass('list-item');
        break;

        case 'S':
        $elem.addClass('strike');
        break;

        case 'TABLE':
        onMainEditorElemAdd_table($elem);
        break;

        case 'TD':
        case 'TH':
        onMainEditorElemAdd_tableCell($elem);
        break;

        case 'TR':
        if($elem.children().length == 0) {
            $elem.remove();
            return;
        }

        onMainEditorElemAdd_tableRow($elem);
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

function onMainEditorElemAdd_table($elem) {
    $elem.addClass('table');

    $.each($elem.find('tr'), (_index, subElem) => {
        onMainEditorElemAdd_tableRow($(subElem));
    });
}

function onMainEditorElemAdd_tableRow($elem) {
    $elem.addClass('table-row');

    $.each($elem.find('td, th'), (_index, subElem) => {
        onMainEditorElemAdd_tableCell($(subElem));
    });
}

function onMainEditorElemAdd_tableCell($elem) {
    $elem.addClass('table-cell');

    if($elem[0].tagName == 'TH') {
        $elem.addClass('table-header');
    }
}

function onEditorPaste(event) {
    // event.preventDefault();
    // console.log(event.clipboardData.setData('Text', event.clipboardData.getData('Text')));
}

function onKeyDown(event) {
    if($(':focus').attr('id') === 'MainEditor') {
        let selection = window.getSelection();
        let selectionRange = selection.getRangeAt(0);
        let $target = $(selectionRange.startContainer);

        if(selectionRange.startContainer.constructor.name == 'Text') {
            $target = $(selectionRange.startContainer.parentElement);
        }

        let isCaretAtLineBegin;

        if($target.attr('id') == 'MainEditor') {
            switch($target.children().length) {
                case 0:
                $target.append('<div></div>');
                isCaretAtLineBegin = true;
                break;

                case 1:
                $target = $target.children().eq(0);
                isCaretAtLineBegin = selectionRange.startOffset == 0;
                break;

                default:
                $target = $target.children().eq(selectionRange.startOffset);
                isCaretAtLineBegin = true;
                break;
            }
        } else {
            isCaretAtLineBegin = selectionRange.startOffset == 0;
        }

        // note: スペース入力によるタイトルやリストの生成
        if(event.key === ' ') {
            if($target.html().startsWith('##')) {
                let titleNum = 2;

                for(; titleNum < $target.html().length; titleNum += 1) {
                    if($target.html()[titleNum] != '#') {
                        break;
                    }
                }

                if(titleNum > 4) {
                    return;
                }

                let text = $target.html().substring(titleNum);

                if(text.length == 0) {
                    $target.html('<br>' + text);
                } else {
                    $target.html(text);
                }

                $target.removeAttr('class');
                $target.addClass('title-' + String(titleNum));
                event.preventDefault();
                return;
            }

            if($target.text().startsWith('-')) {
                let $listItem = $('<li class="list-item"></li>');
                $listItem.addClass('list-item');
                $listItem.data('validateList', 'true');
                $listItem.data('invalidateIndent', 'true');
                $listItem.text($target.text().substring(1));

                if($target.attr('id') == 'MainEditor') {
                    let $targetChildren = $target.children();
                    $targetChildren.children().eq(0).append($listItem);
                } else {
                    $target.replaceWith($listItem);
                }

                event.preventDefault();
                return;
            }

            if(isCaretAtLineBegin) {
                let indent = $target.css('text-indent');
                indent = Number(indent.substring(0, indent.length - 2));
                $target.css('text-indent', (indent + 20) + 'px');
                event.preventDefault();
            }

            return;
        }

        if(event.key === 'Backspace') {
            if(!selectionRange.collapsed || !isCaretAtLineBegin) {
                return;
            }

            if($target[0].tagName == 'TD' && $target.index() == 0) {
                let newRange = document.createRange();
                let selectionTarget = $target.parent().prev().children('td, th').last()[0];
                let selectionOffset = $(selectionTarget).text().length;
                console.log($target.parent().prev().children('td, th'))
                newRange.setStart(selectionTarget, selectionOffset);
                newRange.setEnd(selectionTarget, selectionOffset);
                selection.removeAllRanges();
                selection.addRange(newRange);

                $target.parent().remove();
                event.preventDefault();
            }

            if($target.hasClass('list-item')) {
                let $newElem = $('<div></div>');
                $newElem.css('text-indent', $target.css('text-indent'));

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
        }

        if(event.key === 'Tab') {
            let indent = $target.css('text-indent');
            indent = Number(indent.substring(0, indent.length - 2));
            $target.css('text-indent', (indent + 20) + 'px');
            event.preventDefault();
            return;
        }

        if(event.key === 'Enter') {
            let content = $target.text();

            switch($target[0].tagName) {
                case 'TH':
                case 'TD': {
                    let $newRow = $(`<tr>${'<td></td>'.repeat(3)}<tr>`);
                    $target.parent().after($newRow);

                    let newRange = document.createRange();
                    let selectionTarget = $newRow.find('td')[0];
                    newRange.setStart(selectionTarget, 0);
                    newRange.setEnd(selectionTarget, 0);
                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    event.preventDefault();
                } return;
            }

            if(content.toLowerCase().startsWith('table:')) {
                let args = content.split(':');

                if(args.length == 2) {
                    let title = args[1];

                    let $titleElem = $('<div></div>');
                    $titleElem.addClass('block-title');
                    $titleElem.css('text-indent', '0px');
                    $titleElem.data('keepClass', 'true');
                    $titleElem.text(title);
                    $target.before($titleElem);

                    // note: text() でなぜか動作が変わる
                    $target.text('');

                    let defaultColumnLen = 3;
                    let $table = $(`
                    <table>
                        <tr>
                            ${'<th></th>'.repeat(defaultColumnLen)}
                        </tr>
                        <tr>
                            ${'<td></td>'.repeat(defaultColumnLen)}
                        </tr>
                    </table>`);

                    $target.replaceWith($table);
                    event.preventDefault();
                    return;
                }
            }
        }

        // if(event.key !== 'Process') {
        //     let $mainEditor = $('#MainEditor');

        //     if($mainEditor.children().length == 0) {
        //         // let $mainEditor = $
        //         $mainEditor.append('<div></div>');
        //     }
        // }
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
