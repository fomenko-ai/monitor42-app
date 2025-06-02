async function createHTMLFromTemplate(templatePath, elementMappings) {
  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`Failed to load HTML: ${response.statusText}`);
  }

  const htmlText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const uniqueId = 'distribution-text-' + Math.random().toString(36).substr(2, 9);
  const distributionTextEl = doc.createElement('div');
  distributionTextEl.id = uniqueId;
  distributionTextEl.style.display = 'none';

  let distributionText = '';

  for (const [id, value] of Object.entries(elementMappings)) {
    const el = doc.getElementById(id);
    if (el) {
      if (el.tagName === 'A') {
        el.href = value;
      } else {
        el.textContent = value;
      }
    }

    const label = doc.querySelector(`label[for="${id}"]`);
    if (label) {
      const labelText = label.textContent.trim();
      distributionText += labelText + ' ';
    } 
    distributionText += value + '\n\n';
  }

  distributionTextEl.textContent = distributionText + '\n🔎🌳 Монитор 42: https://42pravo.ru/monitor';
  doc.body.appendChild(distributionTextEl);

  const buttonsContainer = doc.createElement('div');
  buttonsContainer.className = 'buttons-container';

  buttonsContainer.innerHTML = `
    <button type="button" class="share-button" id="copy-share" onclick="copyText('${uniqueId}')">Копировать</button>
    <button type="button" class="share-button" id="vk-share" onclick="shareVK('${uniqueId}')">Поделиться в ВК</button>
    <button type="button" class="share-button" id="tg-share" onclick="shareTelegram('${uniqueId}')">Поделиться в Telegram</button>
  `;

  const footerRow = doc.querySelector('.footer-row');
  if (footerRow) {
    footerRow.appendChild(buttonsContainer);
  }

  return doc.documentElement.outerHTML;
}

async function createAdminMessage(data) {
  return createHTMLFromTemplate('/monitor/static/templates/admin_message.html', {
    'details.text': data.details.text,
    'source_url': data.source_url
  });
}

async function createNNPublicDiscussion(data) {
  return createHTMLFromTemplate('/monitor/static/templates/NN_public_discussion.html', {
    'details.headline': `👥 Общественные обсуждения № ${data.details.number}`,
    'details.title': data.details.title,
    'details.initiator': data.details.initiator,
    'details.period': data.details.period,
    'details.link': data.details.link,
    'source_url': data.source_url
  });
}

async function createNOExpertAssessment(data) {
  return createHTMLFromTemplate('/monitor/static/templates/NO_expert_assessment.html', {
    'details.headline': '📝 Экспертная оценка зеленых насаждений',
    'details.title': data.details.title,
    'details.expert': data.details.expert,
    'details.publication_date': data.details.publication_date,
    'source_url': data.source_url
  });
}

async function createNONews(data) {
  return createHTMLFromTemplate('/monitor/static/templates/NO_news.html', {
    'details.headline': `📰 "${data.details.media_name}"`,
    'details.short_text': data.details.short_text,
    'source_url': data.details.link
  });
}

function getFunctionByDocType(docType) {
  const functionMap = {
    'admin_message': createAdminMessage,
    'NN_public_discussion': createNNPublicDiscussion,
    'NO_expert_assessment': createNOExpertAssessment,
    'NO_gipernn_news': createNONews,
    'NO_kommersant_news': createNONews,
    'NO_nn_now_news': createNONews
  };

  return functionMap[docType] || null;
}
