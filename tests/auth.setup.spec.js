import { test as setup } from '@playwright/test';

setup('login', async ({ page }) => {

    await page.goto(
        'https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com'
    );

    // Login manually while this browser is running

    await page.pause();

    // After you have reached the Home screen,
    // continue the test and save the session

    await page.context().storageState({
        path: 'playwright/.auth/user.json'
    });
});