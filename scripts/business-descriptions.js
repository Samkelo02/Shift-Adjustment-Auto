// Display descriptions for the business report; raw evidence remains in JSON.
export function businessDescription(value = '') {
 const text = String(value);
 if (text.startsWith('Final screen:')) return 'Review the final application screen.';
 if (text === 'Screen before browser context closes') return 'Review the application screen at the end of the session.';
 if (text === 'Screen at test start') return 'Review the starting application screen.';
 const phase = text.startsWith('Before ') ? 'Before the action: ' : text.startsWith('After ') ? 'After the action: ' : '';
 const action = text.replace(/^(Before|After) /, '');
 if (/^page\.(goto|reload)/.test(action)) return phase + 'open the application page.';
 if (/^page\.goBack/.test(action)) return phase + 'return to the previous page.';
 if (/^page\.goForward/.test(action)) return phase + 'go to the next page.';
 if (/^keyboard\./.test(action)) return phase + (/type|insertText/.test(action) ? 'enter text using the keyboard.' : 'use the keyboard to interact with the selected control.');
 if (!/getBy|locator\(|\.nth\(|\.first\(|\.last\(|page\./.test(action)) return text;
 const labels = [...action.matchAll(/(?:name|hasText):\s*(['"])(.*?)\1/g)].map(match => match[2]);
 const texts = [...action.matchAll(/getBy(?:Text|Label)\(\s*(['"])(.*?)\1/g)].map(match => match[2]);
 const regexLabel = action.match(/hasText:\s*\/\^?(.+?)\$?\//)?.[1];
 let label = texts.find(item => item !== 'Select Options') || labels.at(-1) || regexLabel || '';
 if (/icon=["']edit/.test(action)) label = 'Edit record';
 else if (/icon=["']delete/.test(action)) label = 'Delete record';
 else if (/delete-.*confirm|confirmation.*confirm-button/.test(action)) label = 'Confirm deletion';
 else if (/switch-confirmations-confirm-button/.test(action)) label = 'Confirm switch to Configuration';
 else if (/clear-icon-wrapper/.test(action)) label = 'Clear search';
 else if (/role-filter/.test(action)) label = 'Role filter';
 else if (/category-filter/.test(action)) label = 'Category filter';
 else if (/period-filter/.test(action)) label = 'Period filter';
 else if (/this-year/.test(action)) label = 'This Year';
 else if (/this-month/.test(action)) label = 'This Month';
 else if (/severityId/.test(action)) label = 'Severity';
 else if (/ui5-multi-combobox/.test(action)) label = 'Notification audience';
 if (label === 'switch') label = 'Switch to Configuration';
 if (label === 'yyyy-MM-dd') label = 'End date';
 if (label === 'Status Message Message') label = 'Notification message';
 if (!label) label = 'the selected control';
 if (/^(fill|type|pressSequentially)/.test(action)) return phase + 'enter a value in ' + label + '.';
 if (/^press/.test(action)) return phase + 'use the keyboard on ' + label + '.';
 if (/^scrollIntoViewIfNeeded/.test(action)) return phase + 'scroll to ' + label + '.';
 if (/^hover/.test(action)) return phase + 'move the pointer over ' + label + '.';
 if (/^setInputFiles/.test(action)) return phase + 'attach the selected file.';
 return phase + 'select ' + label + '.';
}
export function failureDescription(value = '') {
 const text = String(value).replace(/\u001b\[[0-9;]*m/g, '');
 if (/returned HTTP 5\d\d/.test(text)) return 'The application service returned a server error while loading the requested data.';
 if (/navigating to/.test(text) && /Timeout/.test(text)) return 'The application page did not finish loading within the allowed time.';
 if (/waitForResponse/.test(text)) return 'The application data response did not arrive within the allowed time.';
 if (/toBeEnabled/.test(text)) return 'The required control remained disabled, so the requested action could not continue.';
 if (/toHaveCount/.test(text) && /Expected:\s*0/.test(text)) return 'The record remained visible when it was expected to be absent.';
 if (/Timeout|timeout/.test(text)) return 'The requested page or control was not ready within the allowed time.';
 return 'The displayed result did not match the expected application behaviour.';
}
