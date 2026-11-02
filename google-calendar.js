
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const calendarContainer = $("google-calendar-events");
  const calendarControls = $("google-calendar-controls");
  const calendarMessage = $("google-calendar-message");
  const refreshButton = $("google-refresh-btn");
  const addButton = $("google-add-event-btn");
  const connectButton = $("google-connect-btn");

  let displayedMonth = new Date();
  displayedMonth.setDate(1);

  let events = [];
  let signedIn = false;
  let loading = false;

  const pad = (value) => String(value).padStart(2, "0");

  function dateKey(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-");
  }

  function parseDateKey(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function setMessage(message, isError = false) {
    if (!calendarMessage) return;
    calendarMessage.textContent = message;
    calendarMessage.style.color = isError ? "#b42318" : "";
  }

  function localDateTimeValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      "T",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes()),
    ].join("");
  }

  function isAllDay(event) {
    return Boolean(event.start?.date);
  }

  function eventStartDate(event) {
    const value = event.start?.date || event.start?.dateTime;
    if (!value) return null;

    if (event.start?.date) return parseDateKey(value);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventEndDate(event) {
    const value = event.end?.date || event.end?.dateTime;
    if (!value) return null;

    if (event.end?.date) return parseDateKey(value);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventsForDay(day) {
    const key = dateKey(day);

    return events.filter((event) => {
      const start = eventStartDate(event);
      const end = eventEndDate(event);
      if (!start || !end) return false;

      if (isAllDay(event)) {
        // Google Calendar의 종일 일정 종료일은 미포함 날짜
        return key >= event.start.date && key < event.end.date;
      }

      return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
        day <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  }

  async function callCalendar(action, data = {}) {
    if (typeof window.callGoogleCalendarFunction !== "function") {
      throw new Error(
        "캘린더 연결 코드가 없습니다. app.js의 설정을 확인해 주세요."
      );
    }

    return window.callGoogleCalendarFunction("google-calendar-api", {
      action,
      ...data,
    });
  }

  function updateControls() {
    if (calendarControls) {
      calendarControls.classList.toggle("hidden", !signedIn);
    }

    // 브라우저 Google OAuth 연결 버튼은 더 이상 사용하지 않음
    if (connectButton) {
      connectButton.hidden = true;
    }

    const select = $("google-calendar-select");
    if (select) {
      const label = select.closest("label");
      if (label) label.hidden = true;
    }

    if (!signedIn) {
      setMessage("가족 일기 사이트에 로그인하면 공유 캘린더를 볼 수 있어요.");
    }
  }

  async function loadMonthEvents() {
    if (!signedIn || loading) return;

    loading = true;
    setMessage("일정을 불러오는 중이에요.");

    try {
      const year = displayedMonth.getFullYear();
      const month = displayedMonth.getMonth();

      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 1).toISOString();

      const result = await callCalendar("list", {
        monthStart,
        monthEnd,
      });

      events = Array.isArray(result?.events) ? result.events : [];
      renderCalendar();
      setMessage("");
    } catch (error) {
      console.error("캘린더 조회 오류:", error);
      setMessage(
        error?.message || "일정을 불러오지 못했어요. 다시 로그인해 주세요.",
        true
      );

      if (calendarContainer) {
        calendarContainer.innerHTML =
          '<p class="calendar-hint">일정을 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.</p>';
      }
    } finally {
      loading = false;
    }
  }

  function renderCalendar() {
    if (!calendarContainer) return;

    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

// 일요일부터 시작하는 달력
const offset = firstDay.getDay();
const totalCells = Math.ceil((offset + lastDay.getDate()) / 7) * 7;

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    let html = `
      <section class="family-calendar">
        <div class="family-calendar-header">
          <button type="button" class="button button-light" data-calendar-nav="-1"
            aria-label="이전 달">‹</button>
          <h3>${year}년 ${month + 1}월</h3>
          <button type="button" class="button button-light" data-calendar-nav="1"
            aria-label="다음 달">›</button>
        </div>
        <div class="family-calendar-grid">
         ${weekdays.map((day, index) =>
  `<div class="family-calendar-weekday${index === 0 ? " is-sunday" : index === 6 ? " is-saturday" : ""}">${day}</div>`
).join("")}
    `;

    for (let index = 0; index < totalCells; index++) {
      const dayNumber = index - offset + 1;
      const inMonth = dayNumber >= 1 && dayNumber <= lastDay.getDate();

      if (!inMonth) {
        html += '<div class="family-calendar-day is-empty"></div>';
        continue;
      }

const day = new Date(year, month, dayNumber);
const today = dateKey(day) === dateKey(new Date());
const dayEvents = eventsForDay(day);
const weekendClass =
  day.getDay() === 0 ? " is-sunday" :
  day.getDay() === 6 ? " is-saturday" : "";

      html += `
        <div class="family-calendar-day${today ? " is-today" : ""}${weekendClass}">
  <button type="button" class="family-calendar-date${weekendClass}"
    data-add-date="${dateKey(day)}">${dayNumber}</button>
          <div class="family-calendar-day-events">
            ${dayEvents.map((event) => `
              <button type="button" class="family-calendar-event"
                data-edit-event="${escapeHtml(event.id)}"
                title="${escapeHtml(event.summary || "제목 없는 일정")}">
                ${escapeHtml(event.summary || "제목 없는 일정")}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    html += `
        </div>
        <p class="calendar-hint">
          날짜를 누르면 일정을 추가하고, 일정 제목을 누르면 수정할 수 있어요.
        </p>
      </section>
    `;

    calendarContainer.innerHTML = html;
  }

  function openEventEditor(event = null, selectedDate = dateKey(new Date())) {
    const editing = Boolean(event);
    const allDay = event ? isAllDay(event) : true;

    let startDate = selectedDate;
    let endDate = selectedDate;

    if (event) {
      const start = eventStartDate(event);
      const end = eventEndDate(event);

      if (start) startDate = dateKey(start);

      if (end) {
        if (isAllDay(event)) {
          const inclusiveEnd = new Date(end);
          inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
          endDate = dateKey(inclusiveEnd);
        } else {
          endDate = dateKey(end);
        }
      }
    }

    const startTime = event && !allDay
      ? localDateTimeValue(event.start.dateTime)
      : `${startDate}T09:00`;

    const endTime = event && !allDay
      ? localDateTimeValue(event.end.dateTime)
      : `${endDate}T10:00`;

    const modal = document.createElement("div");
    modal.className = "family-calendar-modal";
    modal.innerHTML = `
      <div class="family-calendar-modal-panel" role="dialog"
        aria-modal="true" aria-labelledby="calendar-editor-title">
        <h3 id="calendar-editor-title">${editing ? "일정 수정" : "일정 추가"}</h3>

        <form class="family-calendar-form">
          <label>
            일정 제목
            <input name="summary" required maxlength="200"
              value="${escapeHtml(event?.summary || "")}"
              placeholder="예: 가족 외식">
          </label>

          <label>
            메모
            <textarea name="description" rows="3"
              placeholder="일정에 대한 메모">${escapeHtml(event?.description || "")}</textarea>
          </label>

          <label class="family-calendar-checkbox">
            <input name="allDay" type="checkbox" ${allDay ? "checked" : ""}>
            종일 일정
          </label>

          <div class="family-calendar-date-fields">
            <label class="all-day-field">
              시작일
              <input name="startDate" type="date" required value="${startDate}">
            </label>
            <label class="all-day-field">
              종료일
              <input name="endDate" type="date" required value="${endDate}">
            </label>
            <label class="timed-field">
              시작 일시
              <input name="startTime" type="datetime-local" value="${startTime}">
            </label>
            <label class="timed-field">
              종료 일시
              <input name="endTime" type="datetime-local" value="${endTime}">
            </label>
          </div>

          <p class="calendar-hint">
            종료일은 포함되는 날짜로 입력해 주세요.
          </p>

          <div class="family-calendar-modal-actions">
            ${editing ? '<button type="button" class="button button-danger" data-delete-event>삭제</button>' : ""}
            <span class="family-calendar-spacer"></span>
            <button type="button" class="button button-light" data-close>취소</button>
            <button type="submit" class="button button-primary">저장</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("form");
    const allDayCheckbox = form.elements.allDay;
    const startDateInput = form.elements.startDate;
    const endDateInput = form.elements.endDate;
    const startTimeInput = form.elements.startTime;
    const endTimeInput = form.elements.endTime;

    function updateDateFields() {
      const useAllDay = allDayCheckbox.checked;

      modal.querySelectorAll(".all-day-field").forEach((label) => {
        label.hidden = !useAllDay;
      });

      modal.querySelectorAll(".timed-field").forEach((label) => {
        label.hidden = useAllDay;
      });

      startDateInput.required = useAllDay;
      endDateInput.required = useAllDay;
      startTimeInput.required = !useAllDay;
      endTimeInput.required = !useAllDay;
    }

    allDayCheckbox.addEventListener("change", updateDateFields);
    updateDateFields();

    function closeModal() {
      modal.remove();
    }

    modal.querySelector("[data-close]").addEventListener("click", closeModal);

    modal.addEventListener("click", (clickEvent) => {
      if (clickEvent.target === modal) closeModal();
    });

    const deleteButton = modal.querySelector("[data-delete-event]");

    if (deleteButton) {
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm("이 일정을 삭제할까요?")) return;

        deleteButton.disabled = true;
        setMessage("일정을 삭제하는 중이에요.");

        try {
          await callCalendar("delete", { eventId: event.id });
          closeModal();
          setMessage("일정을 삭제했어요.");
          await loadMonthEvents();
        } catch (error) {
          console.error("일정 삭제 오류:", error);
          setMessage(error?.message || "일정을 삭제하지 못했어요.", true);
          deleteButton.disabled = false;
        }
      });
    }

    form.addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();

      const summary = form.elements.summary.value.trim();
      const description = form.elements.description.value.trim();
      const useAllDay = allDayCheckbox.checked;

      if (!summary) {
        setMessage("일정 제목을 입력해 주세요.", true);
        return;
      }

      let start;
      let end;

      if (useAllDay) {
        const startValue = startDateInput.value;
        const endValue = endDateInput.value;

        if (!startValue || !endValue || endValue < startValue) {
          setMessage("시작일과 종료일을 확인해 주세요.", true);
          return;
        }

        const exclusiveEnd = parseDateKey(endValue);
        exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);

        start = { date: startValue };
        end = { date: dateKey(exclusiveEnd) };
      } else {
        const startValue = startTimeInput.value;
        const endValue = endTimeInput.value;

        if (!startValue || !endValue ||
            new Date(endValue) <= new Date(startValue)) {
          setMessage("종료 일시는 시작 일시보다 늦어야 해요.", true);
          return;
        }

        start = { dateTime: new Date(startValue).toISOString() };
        end = { dateTime: new Date(endValue).toISOString() };
      }

      const submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;
      setMessage("일정을 저장하는 중이에요.");

      try {
        const payload = {
          summary,
          description,
          start,
          end,
        };

        if (editing) payload.eventId = event.id;

        await callCalendar("save", payload);

        closeModal();
        setMessage("일정을 저장했어요.");
        await loadMonthEvents();
      } catch (error) {
        console.error("일정 저장 오류:", error);
        setMessage(error?.message || "일정을 저장하지 못했어요.", true);
        submitButton.disabled = false;
      }
    });
  }

  function handleCalendarClick(event) {
    const navButton = event.target.closest("[data-calendar-nav]");

    if (navButton) {
      displayedMonth.setMonth(
        displayedMonth.getMonth() + Number(navButton.dataset.calendarNav)
      );
      loadMonthEvents();
      return;
    }

    const addDateButton = event.target.closest("[data-add-date]");

    if (addDateButton) {
      openEventEditor(null, addDateButton.dataset.addDate);
      return;
    }

    const editButton = event.target.closest("[data-edit-event]");

    if (editButton) {
      const selectedEvent = events.find(
        (item) => item.id === editButton.dataset.editEvent
      );

      if (selectedEvent) openEventEditor(selectedEvent);
    }
  }

  function handleAuthChange(event) {
    signedIn = Boolean(event.detail?.signedIn);
    updateControls();

    if (signedIn) {
      loadMonthEvents();
    } else {
      events = [];

      if (calendarContainer) {
        calendarContainer.innerHTML =
          '<p class="calendar-hint">로그인하면 가족 공유 캘린더를 확인할 수 있어요.</p>';
      }
    }
  }

  function initializeCalendar() {
    if (!calendarContainer) {
      console.warn("google-calendar-events 요소를 찾을 수 없습니다.");
      return;
    }

    calendarContainer.addEventListener("click", handleCalendarClick);

    if (refreshButton) {
      refreshButton.addEventListener("click", loadMonthEvents);
    }

    if (addButton) {
      addButton.addEventListener("click", () => {
        openEventEditor(null, dateKey(new Date()));
      });
    }

    window.addEventListener("family-auth-changed", handleAuthChange);

    updateControls();

    // 초기 로그인 여부는 실제 서버 호출로 확인한다.
    // 로그인하지 않은 경우 안내 문구를 표시하고 종료한다.
    if (typeof window.callGoogleCalendarFunction === "function") {
      callCalendar("list", {
        monthStart: new Date(
          displayedMonth.getFullYear(),
          displayedMonth.getMonth(),
          1
        ).toISOString(),
        monthEnd: new Date(
          displayedMonth.getFullYear(),
          displayedMonth.getMonth() + 1,
          1
        ).toISOString(),
      })
        .then((result) => {
          signedIn = true;
          events = Array.isArray(result?.events) ? result.events : [];
          updateControls();
          renderCalendar();
          setMessage("");
        })
        .catch(() => {
          // 로그인 이벤트가 발생하면 다시 조회한다.
          signedIn = false;
          updateControls();
        });
    }
  }

  // 기존 페이지의 기본 레이아웃과 함께 실행
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCalendar);
  } else {
    initializeCalendar();
  }
})();
