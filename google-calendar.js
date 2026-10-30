
const GOOGLE_CLIENT_ID = "309562030182-jit2t0v0ae7kiugr9mganp5v5glh2eek.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyA3EF3XnFFEBiNmp5DU5WLwribC-7Guytw";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events"
].join(" ");

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const $ = (id) => document.getElementById(id);

let tokenClient;
let googleReady = false;
let selectedCalendar = "";
let displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let events = [];

function showMessage(message, error = false) {
  const el = $("google-calendar-message");
  if (el) {
    el.textContent = message;
    el.style.color = error ? "#b15f50" : "";
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateTimeValue(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function parseLocalDateTime(value) {
  return new Date(value);
}

function eventStartKey(event) {
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) {
    return dateKey(new Date(event.start.dateTime));
  }
  return "";
}

function eventTimeLabel(event) {
  if (event.start?.date && !event.start?.dateTime) return "종일";
  if (!event.start?.dateTime) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(event.start.dateTime));
}

async function initializeCalendar() {
  try {
    if (
      GOOGLE_CLIENT_ID.startsWith("여기에_") ||
      GOOGLE_API_KEY.startsWith("여기에_")
    ) {
      showMessage("파일 맨 위에 기존 OAuth 클라이언트 ID와 API 키를 입력해 주세요.", true);
      return;
    }

    await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client")
    ]);

    await new Promise(resolve => gapi.load("client", resolve));

    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: [DISCOVERY_DOC]
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          showMessage("구글 인증에 실패했어요. 테스트 사용자 설정을 확인해 주세요.", true);
          return;
        }

        gapi.client.setToken({ access_token: response.access_token });
        $("google-connect-btn").textContent = "구글 계정 연결됨";
        $("google-calendar-controls").classList.remove("hidden");

        await loadCalendars();
      }
    });

    googleReady = true;
    renderCalendarShell();
  } catch (error) {
    console.error(error);
    showMessage("구글 캘린더 초기화에 실패했어요. API 설정을 확인해 주세요.", true);
  }
}

async function connectCalendar() {
  if (!googleReady) {
    showMessage("캘린더를 준비 중이에요. 잠시 후 다시 눌러 주세요.");
    return;
  }

  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function loadCalendars() {
  try {
    showMessage("캘린더를 불러오는 중이에요.");

    const response = await gapi.client.calendar.calendarList.list({
      maxResults: 250
    });

    const calendars = response.result.items || [];
    const select = $("google-calendar-select");
    select.replaceChildren();

    calendars.forEach(calendar => {
      const option = document.createElement("option");
      option.value = calendar.id;
      option.textContent = calendar.summary || "이름 없는 캘린더";
      select.appendChild(option);
    });

    if (!calendars.length) {
      showMessage("접근 가능한 캘린더가 없어요.", true);
      return;
    }

    selectedCalendar = select.value;
    await loadMonthEvents();
  } catch (error) {
    console.error(error);
    showMessage("캘린더 목록을 불러오지 못했어요. 계정과 공유 권한을 확인해 주세요.", true);
  }
}

async function loadMonthEvents() {
  selectedCalendar = $("google-calendar-select").value;
  if (!selectedCalendar) return;

  const start = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
  const end = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);

  try {
    showMessage("일정을 불러오는 중이에요.");

    const response = await gapi.client.calendar.events.list({
      calendarId: selectedCalendar,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 2500,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false
    });

    events = response.result.items || [];
    renderCalendar();
    showMessage(`${displayedMonth.getFullYear()}년 ${displayedMonth.getMonth() + 1}월 일정을 불러왔어요.`);
  } catch (error) {
    console.error(error);
    showMessage("일정을 불러오지 못했어요. 캘린더 권한을 확인해 주세요.", true);
  }
}

function renderCalendarShell() {
  const container = $("google-calendar-events");
  if (!container) return;

  container.innerHTML = `
    <div class="month-toolbar">
      <div class="month-navigation">
        <button type="button" id="month-prev" class="button button-light" aria-label="이전 달">‹</button>
        <button type="button" id="month-today" class="button button-light">오늘</button>
        <button type="button" id="month-next" class="button button-light" aria-label="다음 달">›</button>
      </div>
      <h3 id="month-title"></h3>
    </div>
    <div class="month-weekdays">
      <span>일</span><span>월</span><span>화</span><span>수</span>
      <span>목</span><span>금</span><span>토</span>
    </div>
    <div id="month-grid" class="month-grid"></div>
    <p class="calendar-hint">날짜를 누르면 일정을 추가할 수 있어요. 기존 일정을 누르면 수정하거나 삭제할 수 있어요.</p>
  `;

  $("month-prev").addEventListener("click", () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
    loadMonthEvents();
  });

  $("month-next").addEventListener("click", () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
    loadMonthEvents();
  });

  $("month-today").addEventListener("click", () => {
    displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    loadMonthEvents();
  });

  renderCalendar();
}

function renderCalendar() {
  const grid = $("month-grid");
  const title = $("month-title");
  if (!grid || !title) return;

  title.textContent =
    `${displayedMonth.getFullYear()}년 ${displayedMonth.getMonth() + 1}월`;

  grid.replaceChildren();

  const firstDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
  const lastDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0);
  const today = dateKey(new Date());
  const cellCount = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < cellCount; i++) {
    const dayNumber = i - firstDay.getDay() + 1;
    const cellDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), dayNumber);
    const inMonth = cellDate.getMonth() === displayedMonth.getMonth();
    const key = dateKey(cellDate);

    const cell = document.createElement("div");
    cell.className = "month-cell";
    if (!inMonth) cell.classList.add("outside-month");
    if (key === today) cell.classList.add("today-cell");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "day-number";
    addButton.textContent = String(cellDate.getDate());
    addButton.disabled = !inMonth;
    addButton.setAttribute("aria-label", `${key} 일정 추가`);
    addButton.addEventListener("click", () => openEventEditor(null, key));
    cell.appendChild(addButton);

    events
      .filter(event => eventStartKey(event) === key)
      .forEach(event => {
        const eventButton = document.createElement("button");
        eventButton.type = "button";
        eventButton.className = "month-event";
        eventButton.textContent =
          `${eventTimeLabel(event)}${eventTimeLabel(event) ? " " : ""}${event.summary || "제목 없는 일정"}`;
        eventButton.title = "눌러서 일정 수정";
        eventButton.addEventListener("click", () => openEventEditor(event));
        cell.appendChild(eventButton);
      });

    if (inMonth) {
      const addLink = document.createElement("button");
      addLink.type = "button";
      addLink.className = "day-add";
      addLink.textContent = "+";
      addLink.title = "일정 추가";
      addLink.addEventListener("click", () => openEventEditor(null, key));
      cell.appendChild(addLink);
    }

    grid.appendChild(cell);
  }
}

function openEventEditor(event = null, date = dateKey(new Date())) {
  const old = $("calendar-editor-overlay");
  if (old) old.remove();

  const isAllDay = event
    ? Boolean(event.start?.date && !event.start?.dateTime)
    : false;

  const startDate = event
    ? event.start?.dateTime
      ? dateTimeValue(new Date(event.start.dateTime))
      : `${event.start?.date || date}T09:00`
    : `${date}T09:00`;

  const endDate = event
    ? event.end?.dateTime
      ? dateTimeValue(new Date(event.end.dateTime))
      : `${event.end?.date || date}T10:00`
    : `${date}T10:00`;

  const overlay = document.createElement("div");
  overlay.id = "calendar-editor-overlay";
  overlay.className = "calendar-editor-overlay";

  const panel = document.createElement("form");
  panel.className = "calendar-editor";
  panel.innerHTML = `
    <div class="editor-heading">
      <h3>${event ? "일정 수정" : "새 일정 추가"}</h3>
      <button type="button" id="editor-close" class="button button-light">닫기</button>
    </div>
    <label>일정 제목
      <input id="editor-title" required maxlength="200" placeholder="예: 가족 외식">
    </label>
    <label class="all-day-label">
      <input id="editor-all-day" type="checkbox" ${isAllDay ? "checked" : ""}>
      종일 일정
    </label>
    <label>시작
      <input id="editor-start" type="datetime-local" required value="${startDate}">
    </label>
    <label>종료
      <input id="editor-end" type="datetime-local" required value="${endDate}">
    </label>
    <label>메모
      <textarea id="editor-description" rows="3" maxlength="2000"></textarea>
    </label>
    <p id="editor-error" class="form-message" role="status"></p>
    <div class="editor-actions">
      ${event ? '<button type="button" id="editor-delete" class="button button-light">일정 삭제</button>' : ""}
      <button type="submit" class="button button-primary">${event ? "변경 사항 저장" : "일정 등록"}</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  $("editor-title").value = event?.summary || "";
  $("editor-description").value = event?.description || "";

  const close = () => overlay.remove();
  $("editor-close").addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

  $("editor-all-day").addEventListener("change", e => {
    const allDay = e.target.checked;
    $("editor-start").type = allDay ? "date" : "datetime-local";
    $("editor-end").type = allDay ? "date" : "datetime-local";

    if (allDay) {
      $("editor-start").value = $("editor-start").value.slice(0, 10);
      $("editor-end").value = $("editor-end").value.slice(0, 10);
    } else {
      $("editor-start").value = `${$("editor-start").value.slice(0, 10)}T09:00`;
      $("editor-end").value = `${$("editor-end").value.slice(0, 10)}T10:00`;
    }
  });

  if (isAllDay) {
    $("editor-start").type = "date";
    $("editor-end").type = "date";
    $("editor-start").value = event.start.date;
    $("editor-end").value = event.end.date;
  }

  panel.addEventListener("submit", async e => {
    e.preventDefault();

    const summary = $("editor-title").value.trim();
    const allDay = $("editor-all-day").checked;
    const startValue = $("editor-start").value;
    const endValue = $("editor-end").value;

    if (!summary || !startValue || !endValue) return;

    if (endValue <= startValue) {
      $("editor-error").textContent = "종료 시각은 시작 시각보다 뒤여야 해요.";
      return;
    }

    const resource = {
      summary,
      description: $("editor-description").value.trim()
    };

    if (allDay) {
      resource.start = { date: startValue };
      resource.end = { date: endValue };
    } else {
      resource.start = { dateTime: parseLocalDateTime(startValue).toISOString() };
      resource.end = { dateTime: parseLocalDateTime(endValue).toISOString() };
    }

    try {
      if (event) {
        await gapi.client.calendar.events.update({
          calendarId: selectedCalendar,
          eventId: event.id,
          resource
        });
      } else {
        await gapi.client.calendar.events.insert({
          calendarId: selectedCalendar,
          resource
        });
      }

      close();
      showMessage(event ? "일정을 수정했어요." : "새 일정을 등록했어요.");
      await loadMonthEvents();
    } catch (error) {
      console.error(error);
      $("editor-error").textContent = "저장하지 못했어요. 캘린더 편집 권한을 확인해 주세요.";
    }
  });

  if (event) {
    $("editor-delete").addEventListener("click", async () => {
      if (!confirm(`'${event.summary || "제목 없는 일정"}'을(를) 삭제할까요?`)) return;

      try {
        await gapi.client.calendar.events.delete({
          calendarId: selectedCalendar,
          eventId: event.id
        });
        close();
        showMessage("일정을 삭제했어요.");
        await loadMonthEvents();
      } catch (error) {
        console.error(error);
        $("editor-error").textContent = "삭제하지 못했어요. 캘린더 편집 권한을 확인해 주세요.";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("google-connect-btn")?.addEventListener("click", connectCalendar);
  $("google-refresh-btn")?.addEventListener("click", loadMonthEvents);
  $("google-calendar-select")?.addEventListener("change", loadMonthEvents);
  $("google-add-event-btn")?.addEventListener("click", () => openEventEditor());
  initializeCalendar();
});
