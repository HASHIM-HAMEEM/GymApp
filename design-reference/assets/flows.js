/* ============================================================
   MERIDIAN V2 · flows.js — interactive prototypes
   ============================================================ */

/* ---------- F-01 · Sign-in ---------- */
(function () {
  const root = document.getElementById('f1');
  if (!root) return;
  const steps = root.querySelectorAll('[data-f1]');
  const go = (name) => steps.forEach(s => s.classList.toggle('on', s.dataset.f1 === name));
  const phoneField = root.querySelector('#f1-phone-field');
  const phone = root.querySelector('#f1-phone');
  const send = root.querySelector('#f1-send');
  const echo = root.querySelector('#f1-echo');
  const otpWrap = root.querySelector('#f1-otp');
  const otpErr = root.querySelector('#f1-otperr');
  const verify = root.querySelector('#f1-verify');
  const timerEl = root.querySelector('#f1-timer');
  const OK = ['246810', '419346'];
  let timer = null;

  send.addEventListener('click', () => {
    const digits = phone.value.replace(/\D/g, '');
    if (digits.length < 10) {
      phoneField.classList.add('err');
      phone.focus();
      return;
    }
    phoneField.classList.remove('err');
    echo.textContent = '+20 ' + phone.value.trim();
    // reset OTP
    otpWrap.classList.remove('err');
    otpErr.style.display = 'none';
    otpWrap.querySelectorAll('input').forEach(i => i.value = '');
    go('s2');
    setTimeout(() => otpWrap.querySelector('input').focus(), 350);
    startTimer();
  });

  root.querySelector('[data-f1goto="s1"]').addEventListener('click', () => go('s1'));
  root.querySelector('[data-f1reset]').addEventListener('click', () => { phone.value = ''; go('s1'); });

  function startTimer() {
    clearInterval(timer);
    let t = 45;
    timerEl.textContent = 'Resend in 0:45';
    timer = setInterval(() => {
      t--;
      if (t <= 0) { clearInterval(timer); timerEl.innerHTML = '<span style="color:var(--accent-hi); font-weight:600; cursor:pointer;">Resend code</span>'; return; }
      timerEl.textContent = `Resend in 0:${String(t).padStart(2, '0')}`;
    }, 1000);
  }

  const inputs = [...otpWrap.querySelectorAll('input')];
  inputs.forEach((inp, i) => {
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      otpWrap.classList.remove('err');
      otpErr.style.display = 'none';
      if (inp.value && i < 5) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
  });

  verify.addEventListener('click', () => {
    const code = inputs.map(i => i.value).join('');
    if (OK.includes(code)) {
      otpWrap.classList.remove('err');
      otpErr.style.display = 'none';
      go('s3');
      clearInterval(timer);
      setTimeout(() => go('s4'), 1100);
    } else {
      otpWrap.classList.add('err');
      otpErr.style.display = 'flex';
    }
  });
})();

/* ---------- F-02 · Home → QR ---------- */
(function () {
  const root = document.getElementById('f2');
  if (!root) return;
  const steps = root.querySelectorAll('[data-f2]');
  const go = (name) => steps.forEach(s => s.classList.toggle('on', s.dataset.f2 === name));
  root.querySelector('#f2-card').addEventListener('click', () => go('qr'));
  root.querySelector('#f2-fab').addEventListener('click', () => go('qr'));
  root.querySelector('[data-f2close]').addEventListener('click', () => go('home'));
})();

/* ---------- F-03 · Membership state machine ---------- */
(function () {
  const root = document.getElementById('f3');
  if (!root) return;
  const banner = root.querySelector('#f3-banner');
  const ring = root.querySelector('#f3-ring');
  const n = root.querySelector('#f3-n');
  const u = root.querySelector('#f3-u');
  const tag = root.querySelector('#f3-tag');
  const sub = root.querySelector('#f3-sub');
  const kvs = root.querySelector('#f3-kvs');
  const cta = root.querySelector('#f3-cta');
  const switcher = document.querySelector('#f3-switch'); // lives in the caption, outside the phone
  const C = 288.9; // circumference

  const STATES = {
    active: {
      banner: null,
      ringCls: '', ringColor: '', frac: 0.6, num: '34', numColor: '', unit: 'Days left',
      tagCls: 'tag-ok', tagText: 'Active', subText: 'EGP 1,500 / month',
      kv: [
        ['Valid until', '24 Oct 2026', ''],
        ['Last payment', 'EGP 1,500 · 25 Aug', ''],
        ['Auto-renew', 'Off — renew at reception', 'dim'],
      ],
      primary: 'Renew membership', quiet: 'Show QR code',
    },
    expiring: {
      banner: ['warn', 'alertc', '<b>4 days left.</b> Renew by 24 Sep to keep your access uninterrupted.'],
      ringCls: 'warn', ringColor: 'var(--warn)', frac: 0.87, num: '4', numColor: 'var(--warn)', unit: 'Days left',
      tagCls: 'tag-warn', tagText: 'Expiring soon', subText: 'EGP 1,500 / month',
      kv: [
        ['Valid until', '24 Sep 2026', 'warn'],
        ['Renewal price', 'EGP 1,500', ''],
      ],
      primary: 'Renew now — EGP 1,500', quiet: 'Show QR code',
    },
    expired: {
      banner: ['err', 'xc', '<b>Membership expired 15 Aug.</b> Your QR won\'t open the door — renew to restore access.'],
      ringCls: 'bad', ringColor: 'var(--bad)', frac: 1, num: '0', numColor: 'var(--bad)', unit: 'Days left',
      tagCls: 'tag-bad', tagText: 'Expired', subText: 'Ended 15 Aug 2026',
      kv: [
        ['Expired on', '15 Aug 2026', 'bad'],
        ['Visits kept', '8 visits · history intact', ''],
        ['Restart from', 'EGP 1,500', ''],
      ],
      primary: 'Renew membership', quiet: null,
    },
    due: {
      banner: ['warn', 'receipt', '<b>Payment due — EGP 1,500.</b> Access stays on until 24 Sep while this is settled.'],
      ringCls: 'warn', ringColor: 'var(--warn)', frac: 0.87, num: '4', numColor: 'var(--warn)', unit: 'Days left',
      tagCls: 'tag-warn', tagText: 'Payment due', subText: 'Attempted 16 Sep — declined',
      kv: [
        ['Amount due', 'EGP 1,500', 'warn'],
        ['Access until', '24 Sep 2026', ''],
        ['Last attempt', '16 Sep · card declined', 'dim'],
      ],
      primary: 'Pay now — EGP 1,500', quiet: 'Pay at reception instead',
    },
  };

  const ICONS_MAP = {
    cal: 'cal', receipt: 'receipt', refresh: 'refresh', clock: 'clock',
  };
  const KV_ICONS = ['cal', 'receipt', 'refresh', 'clock', 'activity'];

  function render(key) {
    const s = STATES[key];
    // banner
    if (s.banner) {
      banner.className = 'banner ' + s.banner[0];
      banner.style.display = 'flex';
      banner.innerHTML = iconSVG(s.banner[1], 18) + '<div>' + s.banner[2] + '</div>';
    } else {
      banner.style.display = 'none';
    }
    // ring
    ring.setAttribute('class', 'prg ' + s.ringCls);
    ring.style.strokeDashoffset = C * (1 - Math.min(s.frac, 1));
    n.textContent = s.num;
    n.style.color = s.numColor || '';
    u.textContent = s.unit;
    // tag
    tag.className = 'tag ' + s.tagCls;
    tag.innerHTML = '<span class="sdot"></span>' + s.tagText;
    sub.textContent = s.subText;
    // kvs
    kvs.innerHTML = s.kv.map(([k, v, tone], i) => {
      const color = tone === 'warn' ? ' style="color:var(--warn);"' : tone === 'bad' ? ' style="color:var(--bad);"' : tone === 'dim' ? ' style="color:var(--ink-3); font-weight:500;"' : '';
      return `<div class="kv"><span class="k">${iconSVG(KV_ICONS[i % KV_ICONS.length], 17)}${k}</span><span class="v"${color}>${v}</span></div>`;
    }).join('');
    // cta
    cta.innerHTML = `<button class="btn btn-primary btn-block">${s.primary}</button>` +
      (s.quiet ? `<button class="btn btn-quiet btn-block" style="font-size:13.5px;">${s.quiet}</button>` : '');
    // switcher
    switcher.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.st === key));
  }

  switcher.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => render(c.dataset.st)));
  render('active');
})();

/* ---------- F-04 · Admin renewal ---------- */
(function () {
  const root = document.getElementById('f4');
  if (!root) return;
  const steps = root.querySelectorAll('[data-f4]');
  const go = (name) => steps.forEach(s => s.classList.toggle('on', s.dataset.f4 === name));
  const plans = [...root.querySelectorAll('#f4-plans .plan')];
  const paySeg = [...root.querySelectorAll('#f4-pay button')];
  let plan = { name: 'Premium Monthly', price: '1,500' };
  let pay = 'Cash';

  const ENDS = { 'Premium Monthly': '24 Nov 2026', '3-Month': '24 Jan 2027', 'Annual': '24 Oct 2027' };

  plans.forEach(p => p.addEventListener('click', () => {
    plans.forEach(x => x.classList.remove('on'));
    p.classList.add('on');
    plan = { name: p.dataset.name, price: p.dataset.price };
  }));
  paySeg.forEach(b => b.addEventListener('click', () => {
    paySeg.forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    pay = b.dataset.pay;
  }));

  root.querySelector('[data-f4go="review"]').addEventListener('click', () => {
    root.querySelector('#f4-r-plan').textContent = plan.name;
    root.querySelector('#f4-r-end').textContent = ENDS[plan.name];
    root.querySelector('#f4-r-pay').textContent = pay + ' · at desk';
    root.querySelector('#f4-r-total').textContent = 'EGP ' + plan.price;
    go('review');
  });
  root.querySelector('[data-f4go="choose"]').addEventListener('click', () => go('choose'));

  root.querySelector('#f4-confirm').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="ld"></span><span>Recording…</span>';
    setTimeout(() => {
      root.querySelector('#f4-done-msg').innerHTML =
        `${plan.name} is now valid until <b style="color:var(--ink); font-weight:600;">${ENDS[plan.name]}</b>. EGP ${plan.price} recorded as ${pay.toLowerCase()}.`;
      go('done');
      btn.classList.remove('loading');
      btn.innerHTML = 'Confirm &amp; record payment';
    }, 900);
  });

  root.querySelector('[data-f4reset]').addEventListener('click', () => go('choose'));
})();
