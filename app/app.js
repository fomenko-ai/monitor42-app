const keywordsInput = document.getElementById('keywords');
const toggle = document.getElementById('toggleSwitch');
const emailCheckbox = document.getElementById('emailSubscriptionCheckbox');
const emailForm = document.getElementById('emailSubscriptionForm');
const emailInput = document.getElementById('emailInput');
const createButton = document.getElementById('createSubscriptionButton');
const cancelButton = document.getElementById('cancelSubscriptionButton');

let config = null;
let isEmailNotified = false;
let userEmail = '';
let docsId = null;
let lastRequestTime = null;
let monitoringInterval = null;
const MONITORING_INTERVAL_TIMEOUT = 60 * 1000;
const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;

async function initKeyVars() {
  config = await loadConfig();
  console.log("Config loaded: ", config);

  docsId = await loadFromDB(DB_KEYS.DOCS_ID);
  console.log(`Docs Id: ${docsId}`);

  lastRequestTime = await loadFromDB(DB_KEYS.LAST_TIME);
  console.log(`Last Request Time: ${lastRequestTime}`);
  if (lastRequestTime) lastRequestTime = new Date(lastRequestTime);

  const toggleState = await loadFromDB(DB_KEYS.TOGGLE_STATE);
  console.log(`Toggle State: ${toggleState}`);
  if (toggleState) toggle.classList.add('active');

  const savedKeywords = await loadFromDB(DB_KEYS.KEYWORDS_INPUT);
  console.log(`Saved Keywords: ${savedKeywords}`);
  if (savedKeywords) keywordsInput.value = savedKeywords;

  keywordsInput.disabled = toggle.classList.contains('active');

  isEmailNotified = await loadFromDB(DB_KEYS.IS_EMAIL_NOTIFIED) || false;
  console.log(`Is Email Notified: ${isEmailNotified}`);

  userEmail = await loadFromDB(DB_KEYS.USER_EMAIL) || '';
  console.log(`User Email: ${isEmailNotified}`)

  if (isEmailNotified) {
    emailCheckbox.checked = true;
    emailForm.style.display = 'block';
    if (userEmail) emailInput.value = userEmail;
    emailInput.disabled = true;
    createButton.style.display = 'none';
    cancelButton.style.display = 'inline-block';
  } else {
    emailInput.disabled = false;
    createButton.style.display = 'inline-block';
    cancelButton.style.display = 'none';
  }
  checkToggleState(); 
}

toggle.addEventListener('click', async () => {
  toggle.classList.toggle('active');
  const isDisabled = keywordsInput.disabled;
  keywordsInput.disabled = !isDisabled;
  await saveToDB(DB_KEYS.TOGGLE_STATE, toggle.classList.contains('active'));
});

keywordsInput.addEventListener('input', async () => {
  await saveToDB(DB_KEYS.KEYWORDS_INPUT, keywordsInput.value);
});

emailCheckbox.addEventListener('change', () => {
  if (emailCheckbox.checked) {
    emailForm.style.display = 'block';
  } else {
    emailForm.style.display = 'none';
  }
});

async function createEmailSubscription() {
  const email = document.getElementById('emailInput').value.trim();
  const keywords = document.getElementById('keywords').value.trim();

  if (!email || !keywords) {
    customAlert('Укажите e-mail и ключевые слова');
    return;
  }

  try {
    const response = await fetch(`${config.monitor_api_url}/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        keywords: keywords
      })
    });

    if (response.status === 200) {
      customAlert('На почту отправлено письмо подтверждение');

      isEmailNotified = true;
      userEmail = email;

      await saveToDB(DB_KEYS.IS_EMAIL_NOTIFIED, isEmailNotified);
      await saveToDB(DB_KEYS.USER_EMAIL, userEmail);

      emailInput.disabled = true; 
      createButton.style.display = 'none';
      cancelButton.style.display = 'inline-block';
    } else {
      await statusAlert(response.status);
    } 
  } catch (error) {
    console.warn('Error when creating a subscription: ', error);
    customAlert(
      'Ошибка при создании подписки! Попробуйте через 1 час. При повторном возникновении ошибки, напишите нам <a href="mailto:42pravo@gmail.com">42pravo@gmail.com</a>.',
      { isHTML: true }
    );
  }
}

createButton.addEventListener('click', async () => {
  await createEmailSubscription()
});

async function cancelEmailSubscription() {
  if (!userEmail) {
    customAlert('Email не найден');
    return;
  }

  try {
    const response = await fetch(`${config.monitor_api_url}/subscription`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: userEmail })
    });

    if (response.status === 200) {
      customAlert('На почту отправлено письмо подтверждение');

      isEmailNotified = false;

      await saveToDB(DB_KEYS.IS_EMAIL_NOTIFIED, isEmailNotified);
      
      emailInput.disabled = false;
      cancelButton.style.display = 'none';
      createButton.style.display = 'inline-block';
    } else {
      await statusAlert(response.status);
    } 
  } catch (error) {
    console.warn('Error when cancelling a subscription:', error);
    customAlert(
      'Ошибка при отмене подписки! Попробуйте через 1 час. При повторном возникновении ошибки, напишите нам <a href="mailto:42pravo@gmail.com">42pravo@gmail.com</a>.',
      { isHTML: true }
    );
  }
}

cancelButton.addEventListener('click', async () => {
  await cancelEmailSubscription()
})

function showNotification(title) {
  if (Notification.permission === "granted") {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/monitor/static/sw.js').then(registration => {
        if (registration) {
          registration.showNotification(title);
        } else {
          console.warn("No service worker registration available");
          new Notification(title);
        }
      });
    } else {
      console.warn("Service workers are not supported");
      new Notification(title);
    }
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        showNotification(title); 
      }
    });
  }
}

async function updateDocuments(data) {
  const container = document.getElementById('documents_list');
  const clearButton = document.getElementById('clear_button');

  container.innerHTML = ''; 

  for (const doc of data) {
    const docFunction = getFunctionByDocType(doc.type) 
    const docHTML = await docFunction(doc)

    const wrapper = document.createElement('div');

    wrapper.style.border = '1px solid black';
    wrapper.style.backgroundColor = 'white';
    wrapper.style.textAlign = 'left';
    wrapper.style.padding = '10px'; 

    const temp = document.createElement('div');
    temp.innerHTML = docHTML;

    wrapper.appendChild(temp);
    container.appendChild(wrapper);

    const spacer = document.createElement('div');
    spacer.style.height = '20px';
    container.appendChild(spacer);
  };

  if (container.length === 0) {
    clearButton.style.display = 'none';
  } else {
    clearButton.style.display = 'inline-block';
  }
}

function deactivateToggle() {
  const toggle = document.getElementById('toggleSwitch');
  const keywordsInput = document.getElementById('keywords');

  if (toggle.classList.contains('active')) {
    toggle.classList.remove('active');
    keywordsInput.disabled = false;
  }

  stopMonitoring();
}

function isMonitoringActive() {
  return document.getElementById('toggleSwitch').classList.contains('active');
}

async function performMonitoringRequest() {
  if (!isMonitoringActive()) return;

  const keywords = document.getElementById('keywords').value.trim();
  if (!keywords) {
    customAlert('Укажите ключевые слова');
    deactivateToggle();
    return;
  }

  try {
    const url = `${config.monitor_api_url}/documents?q=${encodeURIComponent(keywords)}&docs_id=${docsId}`;
    const response = await fetch(url);

    if (response.status === 200) {
      const data = await response.json();

      console.log("There are new documents.");
      console.log("Data: ", data);

      docsId = data.docs_id || docsId;
      console.log(`New Docs Id: ${docsId}`);
      await saveToDB(DB_KEYS.DOCS_ID, docsId);

      const swDocsId = await loadFromDB(DB_KEYS.SW_DOCS_ID)
      console.log(`SW Docs Id: ${docsId}`);

      if (swDocsId !== docsId) {
        await saveToDB(DB_KEYS.SW_DOCS_ID, docsId);   
        showNotification(`Найдены новые документы: ${data.result.length} шт.`); 
      }

      await updateDocuments(data.result || []);

    } else {
      if (response.status === 204) {
        console.log("There are no new documents.");
      } else {
        await statusAlert(response.status);
      }
      return;
    }

    lastRequestTime = new Date();
    await saveToDB(DB_KEYS.LAST_TIME, lastRequestTime.toISOString());
  } catch (error) {
    console.warn("Request execution error: ", error);
  }
}

async function startMonitoring() {
  if ('serviceWorker' in navigator) {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync'
    });

    if (status.state === 'granted') {
      try {
        navigator.serviceWorker.getRegistration('/monitor/static/sw.js').then(registration => {
          if (registration) {
            console.log('Periodic Sync registration start');
            registration.periodicSync.register('monitor-sync', {minInterval: THREE_HOURS_IN_MS});
            console.log('Periodic Sync registered');
          } else {
            console.warn("No registration available");
          }
        });
      } catch (error) {
        console.log('Periodic Sync registration failed', error);
      }
    } else {
      console.warn('Periodic background sync not granted');
    }

  } else {
    console.warn("Service workers are not supported");
  }

  if (monitoringInterval) clearInterval(monitoringInterval);
  performMonitoringRequest();
  console.log(`Set monitoring interval with timeout: ${MONITORING_INTERVAL_TIMEOUT}`);
  monitoringInterval = setInterval(() => {
    const currentTime = new Date();
    if (!lastRequestTime || (currentTime - lastRequestTime) >= THREE_HOURS_IN_MS) {
      performMonitoringRequest();
    }
  }, MONITORING_INTERVAL_TIMEOUT);
}

async function stopMonitoring() {
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.getRegistration('/monitor/static/sw.js').then(registration => {
        if (registration) {
          registration.periodicSync.getTags().then(
            tags => {
              console.log(`Periodic Sync tags: ${tags}`)
              if (tags.includes('monitor-sync')) {
                registration.periodicSync.unregister('monitor-sync');
                console.log('Periodic Sync unregistered');
              } else {
                console.warn("No monitor-sync tag available");
              }
            }
          );
        } else {
          console.warn("No registration available");
        }
      });
    } catch (error) {
      console.warn('Failed to unregister periodic sync', error);
    }
  } else {
    console.warn("Service workers are not supported");
  }

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('Clear monitoring interval');
  }
}

async function checkToggleState() {
  if (isMonitoringActive()) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
      customAlert('Разрешите отправку уведомлений для приложения');
    }
    if (Notification.permission === "granted") {
      await startMonitoring();  
    } else {
      await stopMonitoring();   
      deactivateToggle();
    }
  } else {
    await stopMonitoring(); 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initKeyVars().catch(console.error);
  document.getElementById('toggleSwitch').addEventListener('click', async () => {
    await checkToggleState(); 
  });
});
