'use strict';

$(() => {
    // let data = {
    //     id: "abc",
    //     tags: ["tag1", "tag2"],
    //     title: "title",
    //     content: "content",
    // };
    // putIDBData(data, () => {
    //     console.log("success");
    // });
    // getIDBData('abc', (result) => {
    //     console.log("result");
    //     console.log(result);
    // });
    // indexedDB.deleteDatabase('eknoto');
});

function operateIDB(callback) {
    let dbName = 'eknoto';
    let storeName = 'notes';
    let openReq = indexedDB.open(dbName, 1);

    openReq.addEventListener('upgradeneeded', (event) => {
        console.log('IDB:Upgrate');

        // アップグレード時は DB 初期化
        let db = event.target.result;
        db.createObjectStore(storeName, { keyPath: 'id' });

        console.log('IDB:ObjStore:Create:notes');
    });

    openReq.addEventListener('success', (event) => {
        callback(dbName, storeName, event);
    });

    openReq.addEventListener('error', (event) => {console.log(event);
        console.log('IDB:Err');
    });
}

function getAllIDBData(onSucceed) {
    operateIDB((_dbName, storeName, event) => {
        let db = event.target.result;
        var trans = db.transaction(storeName, 'readonly');
        var store = trans.objectStore(storeName);
        let getReq = store.getAll();

        getReq.addEventListener('success', (event) => {
            if(onSucceed !== undefined && onSucceed !== null) {
                onSucceed(event.target.result);
            }

            db.close();
        });
    });
}

function getIDBData(key, onSucceed) {
    operateIDB((_dbName, storeName, event) => {
        let db = event.target.result;
        var trans = db.transaction(storeName, 'readonly');
        var store = trans.objectStore(storeName);
        let getReq = store.get(key);

        getReq.addEventListener('success', (event) => {
            if(onSucceed !== undefined && onSucceed !== null) {
                onSucceed(event.target.result);
            }

            db.close();
        });
    });
}

function putIDBData(data, onSucceed) {
    operateIDB((_dbName, storeName, event) => {
        console.log('IDB:Open');

        let db = event.target.result;
        var trans = db.transaction(storeName, 'readwrite');
        var store = trans.objectStore(storeName);
        var putReq = store.put(data);

        putReq.addEventListener('success', () => {
            console.log('IDB:ObjStore:Put:Success');
        });

        trans.addEventListener('complete', () => {
            console.log('IDB:ObjStore:Trans:Complete');

            if(onSucceed !== undefined && onSucceed !== null) {
                onSucceed();
            }

            db.close();
        });
    });
}
