const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch({ headless: false });

    const context = await browser.newContext();

    const page = await context.newPage();

    await page.goto(
        'https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com'
    );

    console.log('');
    console.log('======================================');
    console.log('LOGIN IN THE BROWSER');
    console.log('======================================');
    console.log('After you reach the HOME screen,');
    console.log('come back to this terminal and press ENTER.');
    console.log('');

    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });

    await context.storageState({
        path: 'playwright/.auth/user.json'
    });

    console.log('');
    console.log('SESSION SAVED!');
    console.log('');

    await browser.close();
})();