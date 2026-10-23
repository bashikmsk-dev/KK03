/**
 * Приём заявок фестиваля «Кибер Кино».
 *
 * Этот файл целиком копируется в редактор Google Apps Script, привязанный к
 * таблице заявок (инструкция — в README проекта, раздел «Форма заявки»).
 * Скрипт делает две вещи при каждой отправке формы с сайта:
 *   1) добавляет строку в лист таблицы;
 *   2) отправляет письмо-уведомление организатору, а заявителю — подтверждение.
 *
 * Менять здесь нужно только константы в блоке «Настройки».
 */

/* ======================== Настройки ======================== */

/** Куда приходят уведомления о новых заявках. */
const NOTIFY_EMAIL = 'submit@cyber-kino-festival.ru';

/** Имя листа в таблице. Если листа нет, скрипт создаст его сам. */
const SHEET_NAME = 'Заявки';

/** Отправлять ли заявителю письмо «мы получили вашу заявку». */
const SEND_CONFIRMATION = true;

/**
 * Простая защита от ботов: ключ, который сайт отправляет вместе с заявкой.
 * Должен совпадать со значением в assets/js/config.js на сайте.
 * Это не пароль — он виден в коде страницы, он лишь отсекает случайный спам.
 */
const FORM_KEY = 'cyber-kino-2026';

/* ===================== Дальше править не нужно ===================== */

/** Колонки таблицы: подпись в шапке → ключ поля из формы. */
const COLUMNS = [
  ['Дата и время', 'receivedAt'],
  ['Язык формы', 'locale'],
  ['Название (EN)', 'titleEn'],
  ['Название (оригинал)', 'titleOriginal'],
  ['Режиссёр', 'director'],
  ['Заявитель', 'applicant'],
  ['E-mail', 'email'],
  ['Страна производства', 'country'],
  ['Хронометраж, мин', 'duration'],
  ['Номинация', 'category'],
  ['Ссылка на просмотр', 'screeningLink'],
  ['Пароль к ссылке', 'screeningPassword'],
  ['Синопсис', 'synopsis'],
  ['Материалы (постер, кадры, субтитры)', 'materialsLink'],
  ['Согласие с правилами', 'agreeRules'],
  ['Согласие на обработку данных', 'agreeData'],
];

/** Поля, без которых заявку принимать нельзя. */
const REQUIRED = [
  'titleEn',
  'director',
  'applicant',
  'email',
  'country',
  'duration',
  'category',
  'screeningLink',
  'synopsis',
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return reply({ ok: false, error: 'empty-request' });
    }

    const data = JSON.parse(e.postData.contents);

    // Ловушка для ботов: поле скрыто от человека, заполнить его может только робот.
    if (data.website) {
      return reply({ ok: true });
    }
    if (data.key !== FORM_KEY) {
      return reply({ ok: false, error: 'bad-key' });
    }
    // без согласия с правилами и на обработку данных заявку принимать нельзя
    if (data.agreeRules !== true || data.agreeData !== true) {
      return reply({ ok: false, error: 'no-consent' });
    }

    const missing = REQUIRED.filter(function (field) {
      return !String(data[field] || '').trim();
    });
    if (missing.length) {
      return reply({ ok: false, error: 'missing', fields: missing });
    }

    data.receivedAt = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm');
    data.agreeRules = data.agreeRules ? 'да' : 'нет';
    data.agreeData = data.agreeData ? 'да' : 'нет';

    appendRow(data);
    notify(data);
    if (SEND_CONFIRMATION) confirmToApplicant(data);

    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: String(err) });
  }
}

/** Открыв адрес скрипта в браузере, видно, что он жив. */
function doGet() {
  return reply({ ok: true, service: 'cyber-kino-apply' });
}

function appendRow(data) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    const header = COLUMNS.map(function (c) {
      return c[0];
    });
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow(
    COLUMNS.map(function (c) {
      return String(data[c[1]] || '');
    })
  );
}

function notify(data) {
  const subject = 'Заявка 2026: ' + data.titleEn + ' — ' + data.director;
  const rows = COLUMNS.map(function (c) {
    return (
      '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">' +
      c[0] +
      '</td><td style="padding:4px 0">' +
      escapeHtml(String(data[c[1]] || '—')) +
      '</td></tr>'
    );
  }).join('');

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: data.email,
    subject: subject,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px">' +
      '<p>Новая заявка с сайта фестиваля.</p><table>' +
      rows +
      '</table><p style="color:#666">Ответить можно прямо на это письмо — оно уйдёт заявителю.</p></div>',
  });
}

function confirmToApplicant(data) {
  const ru = data.locale !== 'en';
  MailApp.sendEmail({
    to: data.email,
    replyTo: NOTIFY_EMAIL,
    subject: ru ? 'Кибер Кино: заявка получена' : 'Cyber Kino: submission received',
    htmlBody: ru
      ? '<div style="font-family:Arial,sans-serif;font-size:14px">' +
        '<p>Здравствуйте! Мы получили заявку на фильм «' +
        escapeHtml(data.titleEn) +
        '».</p><p>Уведомление об отборе придёт не позднее чем за три недели до фестиваля. ' +
        'Если нужно что-то дополнить, ответьте на это письмо.</p>' +
        '<p>— Фестиваль «Кибер Кино»</p></div>'
      : '<div style="font-family:Arial,sans-serif;font-size:14px">' +
        '<p>Hello! We have received your submission for “' +
        escapeHtml(data.titleEn) +
        '”.</p><p>Selection notices are sent no later than three weeks before the festival. ' +
        'If you need to add anything, just reply to this email.</p>' +
        '<p>— Cyber Kino Festival</p></div>',
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reply(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
