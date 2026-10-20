import { test, expect } from '@playwright/test';
import { MasterDataPage } from '../tests/pages/master-data.page.js';

for (const { title, medical, query, initial } of [
  { title: 'medical practice number from the failed run', medical: true, query: '34068694', initial: '' },
  { title: 'medical search containing an OData apostrophe', medical: true, query: "O'Brien", initial: '' },
  { title: 'clearing a medical practice-number search', medical: true, query: '', initial: '34068694' },
  { title: 'versioned master-data search', medical: false, query: 'FELM', initial: '' },
]) {
  test(title, async ({ page }) => {
    const requests = [];
    await page.route('https://master-data.example.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') {
        await route.fulfill({ contentType: 'text/html', body: '<ui5-input id="host"><input aria-label="Search"></ui5-input>' });
      } else {
        requests.push(url);
        await route.fulfill({ json: { value: [] } });
      }
    });
    await page.goto('https://master-data.example.test/');
    await page.evaluate(({ medical, initial }) => {
      const host = document.getElementById('host');
      const input = host.querySelector('input');
      input.value = host.value = initial;
      let timer;
      input.addEventListener('input', () => {
        host.value = input.value;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const params = new URLSearchParams();
          if (input.value) {
            if (medical) params.set('$filter', "contains(practiceNumber, '" + input.value.replaceAll("'", "''") + "')");
            else params.set('$search', input.value);
          }
          const endpoint = medical
            ? '/api/master-data/medical-practitioners/MedicalPractitioners'
            : '/api/v1/master-data/organizational-unit/OrganizationalUnits';
          fetch(endpoint + '?' + params);
        }, 75);
      });
    }, { medical, initial });
    const master = new MasterDataPage(page);
    master.referenceSection = { tab: medical ? 'Medical Practitioner' : 'Organizational Structure' };
    await master.setSearch(query);
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe(medical
      ? '/api/master-data/medical-practitioners/MedicalPractitioners'
      : '/api/v1/master-data/organizational-unit/OrganizationalUnits');
    expect(requests[0].searchParams.get(medical ? '$filter' : '$search'))
      .toBe(query ? medical ? "contains(practiceNumber, '" + query.replaceAll("'", "''") + "')" : query : null);
  });
}
