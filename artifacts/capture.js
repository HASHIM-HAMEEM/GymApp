const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const base = 'http://localhost:8082';
  const shot = async (name, path) => {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `./artifacts/${name}.png`, fullPage: true });
    console.log(`  ${name}.png`);
  };

  // 1. Landing page
  await shot('01_landing', '/');

  // 2. Auth screens
  await shot('02_signin', '/signin');
  await shot('03_otp', '/otp');

  // 3. Member screens — need to sign in first
  // The app uses in-memory store, so we need to trigger sign-in via the UI
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.getByText('Open member app').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: './artifacts/04_member_home.png', fullPage: true });
  console.log('  04_member_home.png');

  // Member tabs
  await page.goto(base + '/membership', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/05_member_membership.png', fullPage: true });
  console.log('  05_member_membership.png');

  await page.goto(base + '/visits', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/06_member_visits.png', fullPage: true });
  console.log('  06_member_visits.png');

  await page.goto(base + '/notices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/07_member_notices.png', fullPage: true });
  console.log('  07_member_notices.png');

  await page.goto(base + '/profile', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/08_member_profile.png', fullPage: true });
  console.log('  08_member_profile.png');

  // Stack routes
  await shot('09_qr', '/qr');
  await shot('10_edit_profile', '/edit-profile');
  await shot('11_notice_detail', '/notice?id=n1');
  await shot('12_renew', '/renew?id=MRD-1001');

  // 4. Admin screens
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.getByText('Open admin workspace').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: './artifacts/13_admin_today.png', fullPage: true });
  console.log('  13_admin_today.png');

  await page.goto(base + '/members', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/14_admin_members.png', fullPage: true });
  console.log('  14_admin_members.png');

  await page.goto(base + '/scanner', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/15_admin_scanner.png', fullPage: true });
  console.log('  15_admin_scanner.png');

  await page.goto(base + '/notices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/16_admin_notices.png', fullPage: true });
  console.log('  16_admin_notices.png');

  await page.goto(base + '/profile', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './artifacts/17_admin_profile.png', fullPage: true });
  console.log('  17_admin_profile.png');

  // Admin stack routes
  await shot('18_member_detail', '/member-detail?id=MRD-1001');
  await shot('19_member_new', '/member-new');
  await shot('20_notice_compose', '/notice-compose');

  await browser.close();
  console.log('Done — all screenshots captured');
})();
