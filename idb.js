const DB_NAME = "share-target-db";
const STORE_NAME = "sharedFiles";

function openDB() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {

            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });
}

async function getSharedFiles() {

    const db = await openDB();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(STORE_NAME, "readonly");

        const store = tx.objectStore(STORE_NAME);

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}

async function clearSharedFiles() {

    const db = await openDB();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(STORE_NAME, "readwrite");

        tx.objectStore(STORE_NAME).clear();

        tx.oncomplete = () => resolve();

        tx.onerror = () => reject(tx.error);

    });

}

async function consumeSharedFiles() {

    const files = await getSharedFiles();

    await clearSharedFiles();

    return files;

}
