const DB_NAME = 'monitor-app-db';
const STORE_NAME = 'app-storage';
const DB_VERSION = 1;

const DB_KEYS = {
  DOCS_ID: 'docsId',
  SW_DOCS_ID: 'swDocsId',
  LAST_TIME: 'lastRequestTime',
  TOGGLE_STATE: 'toggleState',
  KEYWORDS_INPUT: 'keywordsInput',
  EMAIL_CHECKBOX: 'emailCheckbox',
  IS_EMAIL_NOTIFIED: 'isEmailNotified',
  USER_EMAIL: 'userEmail'
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}
  
async function loadFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
  
async function saveToDB(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadConfig() {
  try {
    const response = await fetch('/monitor/static/config.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();

  } catch (error) {
    console.error("Error loading config: ", error);
  }
}

async function statusAlert(status) {
  if ([404, 408].includes(status)){
    return;
  } else if (status === 403) {
    customAlert(
      'Извинения принимаются <a href="https://dront.ru/campaign/42pravo">вот здесь</a>.', 
      { isHTML: true }
    );
  } else if (status === 422) {
    customAlert('Ошибка! Проверьте введенные значения.');
  } else if (status === 429) {
    customAlert('Слишком много запросов...\nОтдохните пару часов.');
  } else if (status === 500) {
    customAlert(
      'Ошибка на сервере! Попробуйте через 1 час. При повторном возникновении ошибки, напишите нам <a href="mailto:42pravo@gmail.com">42pravo@gmail.com</a>.',
      { isHTML: true }
    );
  } else {
    customAlert('Ошибка! Попробуйте через 10 минут.');
  }
}