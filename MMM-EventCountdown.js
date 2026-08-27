/* Magic Mirror
 * Module: MMM-EventCountdown
 *
 * By TouaregWarrior
 * Counter styles adapted from MMM-AnimatedCountdowns by ElliAndDad
 * MIT Licensed.
 */

Module.register("MMM-EventCountdown", {
    defaults: {
        include_today: false,
        events: [],
        updateInterval: 1000,
        summaryDisplaySeconds: 5,
        defaultCounterStyle: "digital",
        showSeconds: true
    },

    start: function () {
        this.updateDom();
        this.scheduleNextUpdate();
    },

    scheduleNextUpdate: function () {
        clearTimeout(this.updateTimer);
        var interval = Math.max(250, Number(this.config.updateInterval) || 1000);
        if (this.config.showSeconds === false) {
            var summaryInterval = Math.max(1, Number(this.config.summaryDisplaySeconds) || 5) * 1000;
            interval = Math.max(interval, Math.min(60000, summaryInterval));
        }
        var delay = interval - (Date.now() % interval);
        var self = this;
        this.updateTimer = setTimeout(function () {
            try {
                self.updateCountdown();
            } finally {
                self.scheduleNextUpdate();
            }
        }, delay);
    },

    suspend: function () {
        clearTimeout(this.updateTimer);
    },

    resume: function () {
        this.updateCountdown();
        this.scheduleNextUpdate();
    },

    getDom: function () {
        var wrapper = document.createElement("div");
        wrapper.className = "event-countdown";
        wrapper.id = `${this.identifier}-countdown`;

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var nextEvent = this.getNextEvent(today);

        if (!nextEvent) {
            this.renderedEventKey = null;
            return wrapper;
        }

        this.renderedEventKey = `${nextEvent.date.getTime()}:${nextEvent.event.name}`;

        var emoji = nextEvent.event.emoji || nextEvent.event.icon;
        if (emoji) {
            var emojiElement = document.createElement("div");
            emojiElement.className = "event-emoji";
            emojiElement.textContent = emoji;
            wrapper.appendChild(emojiElement);
        }

        var eventElement = document.createElement("div");
        eventElement.className = "event-name";
        eventElement.textContent = nextEvent.event.name;
        wrapper.appendChild(eventElement);

        var time = this.getTimeRemaining(nextEvent.date);

        var counterStyle = this.getCounterStyle(nextEvent.event);
        var countdownElement = document.createElement("div");
        countdownElement.className = `countdown-container counter-style-${counterStyle}`;
        countdownElement.setAttribute("data-counter-style", counterStyle);
        countdownElement.innerHTML = this.buildCountdownHtml(time, counterStyle);
        wrapper.appendChild(countdownElement);

        var summaries = document.createElement("div");
        summaries.className = "event-summaries";
        this.getUpcomingEvents(today).slice(1).forEach((event, index) => {
            var summary = document.createElement("div");
            summary.className = "event-summary";
            summary.setAttribute("data-summary-index", index);
            summary.textContent = this.getSummaryText(event, today);
            summaries.appendChild(summary);
        });
        wrapper.appendChild(summaries);
        this.renderedSummaryDateKey = this.getDateKey(today);
        this.updateSummaryVisibility(summaries);

        return wrapper;
    },

    getUpcomingEvents: function (today) {
        return this.config.events
            .map((event) => ({ event: event, date: this.getNextDate(event, today) }))
            .filter((event) => event.date !== null && event.date >= today)
            .sort((a, b) => a.date - b.date);
    },

    getNextEvent: function (today) {
        return this.getUpcomingEvents(today)[0];
    },

    getDaysRemaining: function (eventDate, today) {
        var todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        var eventUtc = Date.UTC(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return Math.round((eventUtc - todayUtc) / (24 * 60 * 60 * 1000))
            + Number(this.config.include_today);
    },

    getDateKey: function (date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    },

    getSummaryText: function (upcomingEvent, today) {
        var days = this.getDaysRemaining(upcomingEvent.date, today);
        var emoji = upcomingEvent.event.emoji || upcomingEvent.event.icon;
        var prefix = emoji ? `${emoji} ` : "";
        return `${prefix}${days} ${days === 1 ? "day" : "days"} until ${upcomingEvent.event.name}`;
    },

    updateSummaryVisibility: function (summaries) {
        var items = summaries.querySelectorAll(".event-summary");
        if (items.length === 0) {
            return;
        }

        var displayMilliseconds = Math.max(1, Number(this.config.summaryDisplaySeconds)) * 1000;
        var activeIndex = Math.floor(Date.now() / displayMilliseconds) % items.length;
        items.forEach((item, index) => item.classList.toggle("is-active", index === activeIndex));
    },

    getTimeRemaining: function (eventDate) {
        var millisecondsRemaining = Math.max(0, eventDate.getTime() - Date.now());
        if (this.config.include_today) {
            millisecondsRemaining += 24 * 60 * 60 * 1000;
        }

        var totalSeconds = Math.floor(millisecondsRemaining / 1000);
        return {
            days: Math.floor(totalSeconds / 86400),
            hours: Math.floor((totalSeconds % 86400) / 3600),
            minutes: Math.floor((totalSeconds % 3600) / 60),
            seconds: totalSeconds % 60
        };
    },

    updateCountdown: function () {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var nextEvent = this.getNextEvent(today);
        var eventKey = nextEvent ? `${nextEvent.date.getTime()}:${nextEvent.event.name}` : null;

        if (eventKey !== this.renderedEventKey) {
            this.updateDom(0);
            return;
        }
        if (!nextEvent) {
            return;
        }

        var wrapper = document.getElementById(`${this.identifier}-countdown`);
        if (!wrapper) {
            return;
        }

        var time = this.getTimeRemaining(nextEvent.date);
        var countdownElement = wrapper.querySelector(".countdown-container");
        var counterStyle = this.getCounterStyle(nextEvent.event);
        if (!countdownElement || countdownElement.getAttribute("data-counter-style") !== counterStyle) {
            this.updateDom(0);
            return;
        }
        this.updateCountdownDisplay(countdownElement, time, counterStyle);

        var summaries = wrapper.querySelector(".event-summaries");
        var summaryItems = summaries ? summaries.querySelectorAll(".event-summary") : [];
        var summaryDateKey = this.getDateKey(today);
        if (summaryDateKey !== this.renderedSummaryDateKey) {
            var events = this.getUpcomingEvents(today).slice(1);
            if (summaryItems.length !== events.length) {
                this.updateDom(0);
                return;
            }
            summaryItems.forEach((item, index) => {
                item.textContent = this.getSummaryText(events[index], today);
            });
            this.renderedSummaryDateKey = summaryDateKey;
        }
        this.updateSummaryVisibility(summaries);
    },

    getCounterStyle: function (event) {
        var style = String(event.counterStyle || this.config.defaultCounterStyle || "digital").toLowerCase();
        return ["digital", "flip", "rings", "hourglass"].includes(style) ? style : "digital";
    },

    getTimeValues: function (time) {
        var values = [
            { value: time.days, label: "days", digits: 3, maximum: 365 },
            { value: time.hours, label: "hours", digits: 2, maximum: 24 },
            { value: time.minutes, label: "mins", digits: 2, maximum: 60 },
            { value: time.seconds, label: "secs", digits: 2, maximum: 60 }
        ];
        return this.config.showSeconds !== false ? values : values.slice(0, 3);
    },

    buildCountdownHtml: function (time, style) {
        if (style === "flip") {
            return `<div class="countdown-flip">${this.getTimeValues(time).map((unit) => this.buildFlipUnit(unit)).join("")}</div>`;
        }
        if (style === "rings") {
            return `<div class="countdown-rings">${this.getTimeValues(time).map((unit) => this.buildRingUnit(unit)).join("")}</div>`;
        }
        if (style === "hourglass") {
            return `<div class="countdown-hourglass">${this.getTimeValues(time).map((unit) => this.buildHourglassUnit(unit)).join("")}</div>`;
        }
        return `<div class="countdown-digital">${this.getTimeValues(time).map((unit) => `
            <div class="event-countdown-unit" data-label="${unit.label}">
                <div class="event-countdown-value">${unit.value}</div>
                <div class="event-countdown-label">${unit.label}</div>
            </div>`).join("")}</div>`;
    },

    buildFlipUnit: function (unit) {
        var digits = String(unit.value).padStart(unit.digits, "0");
        return `<div class="flip-group" data-label="${unit.label}">
            <div class="flip-digits">${Array.from(digits).map((digit) => this.buildFlipDigit(digit)).join("")}</div>
            <span class="flip-label">${unit.label}</span>
        </div>`;
    },

    buildFlipDigit: function (digit) {
        return `<div class="flip-digit" data-value="${digit}">
            <span class="flip-digit-top">${digit}</span>
            <span class="flip-digit-bottom">${digit}</span>
            <span class="flip-flap-old">${digit}</span>
            <span class="flip-flap-new">${digit}</span>
        </div>`;
    },

    buildRingUnit: function (unit) {
        var circumference = 2 * Math.PI * 45;
        var offset = circumference - (Math.min(unit.value / unit.maximum, 1) * circumference);
        return `<div class="ring-container" data-label="${unit.label}">
            <svg class="ring-svg" viewBox="0 0 100 100">
                <circle class="ring-bg" cx="50" cy="50" r="45"></circle>
                <circle class="ring-progress" cx="50" cy="50" r="45" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"></circle>
            </svg>
            <div class="ring-content"><span class="ring-value">${unit.value}</span><span class="ring-label">${unit.label}</span></div>
        </div>`;
    },

    buildHourglassUnit: function (unit) {
        var percent = Math.min(unit.value / unit.maximum, 1);
        var topHeight = percent * 30;
        var bottomHeight = (1 - percent) * 30;
        return `<div class="hourglass-container" data-label="${unit.label}" data-last-value="${unit.value}">
            <svg class="hourglass-svg" viewBox="0 0 100 100">
                <defs>
                    <clipPath id="hourglass-top-${unit.label}">
                        <path d="M27 19 H73 C73 36 60 43 50 48 C40 43 27 36 27 19 Z"></path>
                    </clipPath>
                    <clipPath id="hourglass-bottom-${unit.label}">
                        <path d="M50 52 C60 57 73 64 73 81 H27 C27 64 40 57 50 52 Z"></path>
                    </clipPath>
                </defs>
                <path class="hourglass-frame" d="M15 8 H85 V18 H78 C78 37 62 45 54 50 C62 55 78 63 78 82 H85 V92 H15 V82 H22 C22 63 38 55 46 50 C38 45 22 37 22 18 H15 Z"></path>
                <path class="hourglass-glass" d="M27 19 H73 C73 36 60 43 50 48 C40 43 27 36 27 19 M27 81 H73 C73 64 60 57 50 52 C40 57 27 64 27 81"></path>
                <rect class="hourglass-sand hourglass-sand-top" x="27" y="${48 - topHeight}" width="46" height="${topHeight}" clip-path="url(#hourglass-top-${unit.label})"></rect>
                <rect class="hourglass-sand hourglass-sand-bottom" x="27" y="${81 - bottomHeight}" width="46" height="${bottomHeight}" clip-path="url(#hourglass-bottom-${unit.label})"></rect>
                <line class="hourglass-stream" x1="50" y1="48" x2="50" y2="${81 - bottomHeight}"></line>
            </svg>
            <span class="hourglass-value">${unit.value}</span><span class="hourglass-label">${unit.label}</span>
        </div>`;
    },

    updateCountdownDisplay: function (container, time, style) {
        var units = this.getTimeValues(time);
        if (style === "digital") {
            units.forEach((unit) => {
                var value = container.querySelector(`.event-countdown-unit[data-label="${unit.label}"] .event-countdown-value`);
                if (value) {
                    value.textContent = unit.value;
                }
            });
            return;
        }
        if (style === "flip") {
            units.forEach((unit) => this.updateFlipUnit(container, unit));
            return;
        }
        if (style === "rings") {
            units.forEach((unit) => {
                var ring = container.querySelector(`.ring-container[data-label="${unit.label}"]`);
                if (!ring) {
                    return;
                }
                ring.querySelector(".ring-value").textContent = unit.value;
                var circumference = 2 * Math.PI * 45;
                ring.querySelector(".ring-progress").style.strokeDashoffset = circumference - (Math.min(unit.value / unit.maximum, 1) * circumference);
            });
            return;
        }
        units.forEach((unit) => this.updateHourglassUnit(container, unit));
    },

    updateFlipUnit: function (container, unit) {
        var group = container.querySelector(`.flip-group[data-label="${unit.label}"]`);
        if (!group) {
            return;
        }
        var digits = String(unit.value).padStart(unit.digits, "0");
        group.querySelectorAll(".flip-digit").forEach((element, index) => {
            var digit = digits[index];
            if (element.getAttribute("data-value") === digit) {
                return;
            }
            var oldDigit = element.getAttribute("data-value");
            element.setAttribute("data-value", digit);
            element.querySelector(".flip-digit-top").textContent = digit;
            element.querySelector(".flip-digit-bottom").textContent = digit;
            element.querySelector(".flip-flap-old").textContent = oldDigit;
            element.querySelector(".flip-flap-new").textContent = digit;
            element.classList.remove("is-flipping");
            void element.offsetWidth;
            element.classList.add("is-flipping");
        });
    },

    updateHourglassUnit: function (container, unit) {
        var hourglass = container.querySelector(`.hourglass-container[data-label="${unit.label}"]`);
        if (!hourglass) {
            return;
        }

        var lastValue = Number(hourglass.getAttribute("data-last-value"));
        var svg = hourglass.querySelector(".hourglass-svg");
        if (unit.value > lastValue && svg) {
            svg.classList.remove("is-flipping");
            void svg.offsetWidth;
            svg.classList.add("is-flipping");
        }
        hourglass.setAttribute("data-last-value", unit.value);

        var percent = Math.min(unit.value / unit.maximum, 1);
        var topHeight = percent * 30;
        var bottomHeight = (1 - percent) * 30;
        var topSand = hourglass.querySelector(".hourglass-sand-top");
        var bottomSand = hourglass.querySelector(".hourglass-sand-bottom");
        var stream = hourglass.querySelector(".hourglass-stream");

        topSand.setAttribute("y", 48 - topHeight);
        topSand.setAttribute("height", topHeight);
        bottomSand.setAttribute("y", 81 - bottomHeight);
        bottomSand.setAttribute("height", bottomHeight);
        stream.setAttribute("y2", 81 - bottomHeight);
        stream.style.opacity = topHeight > 0 ? "1" : "0";
        hourglass.querySelector(".hourglass-value").textContent = unit.value;
    },

    getNextDate: function (event, today) {
        var repeatYearly = event.repeatYearly !== false;
        var year = today.getFullYear();

        if (event.holiday) {
            if (String(event.holiday).toLowerCase() !== "easter") {
                Log.warn(`MMM-EventCountdown: Unknown holiday "${event.holiday}"`);
                return null;
            }

            var holidayDate = this.getEasterDate(year);
            if (repeatYearly && holidayDate < today) {
                holidayDate = this.getEasterDate(year + 1);
            }
            return holidayDate >= today ? holidayDate : null;
        }

        if (event.rule) {
            var recurringDate = this.getRuleDate(event.rule, year);
            if (repeatYearly && recurringDate < today) {
                recurringDate = this.getRuleDate(event.rule, year + 1);
            }
            return recurringDate >= today ? recurringDate : null;
        }

        var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date || "");
        if (!parts) {
            Log.warn(`MMM-EventCountdown: Invalid date "${event.date}"`);
            return null;
        }

        var configuredYear = Number(parts[1]);
        var month = Number(parts[2]);
        var day = Number(parts[3]);
        var eventDate = this.createDate(repeatYearly ? year : configuredYear, month, day);

        if (repeatYearly && eventDate && eventDate < today) {
            eventDate = this.createDate(year + 1, month, day);
        }
        return eventDate && eventDate >= today ? eventDate : null;
    },

    getEasterDate: function (year) {
        var a = year % 19;
        var b = Math.floor(year / 100);
        var c = year % 100;
        var d = Math.floor(b / 4);
        var e = b % 4;
        var f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4);
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31);
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    },

    getRuleDate: function (rule, year) {
        var month = Number(rule.month);
        var weekday = Number(rule.weekday);
        var occurrence = Number(rule.occurrence);

        if (occurrence === -1 || rule.occurrence === "last") {
            var lastDay = new Date(year, month, 0);
            var backwards = (lastDay.getDay() - weekday + 7) % 7;
            return new Date(year, month - 1, lastDay.getDate() - backwards);
        }

        var firstDay = new Date(year, month - 1, 1);
        var offset = (weekday - firstDay.getDay() + 7) % 7;
        return new Date(year, month - 1, 1 + offset + (occurrence - 1) * 7);
    },

    createDate: function (year, month, day) {
        var date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return null;
        }
        return date;
    },

    getStyles: function () {
        return ["MMM-EventCountdown.css"];
    }
});
