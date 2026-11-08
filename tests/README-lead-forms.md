# Lead forms

Run `node --test tests/lead-forms.test.cjs` from the repository root. These tests use an isolated DOM shim and stubbed transport; they never send email. They cover transport errors, deadlines, receipt matching, duplicate suppression, retry IDs, preserved answers, and safe fallback links. Browser integration and visual checks remain separate.

`assets/lead-forms.js` is the maintained frontend implementation for consultation, mastermind application, and waitlist. Endpoint configuration is at the top of that file. Never put private credentials in client code. The server contract is `{id,type,fields,website}` and success requires HTTP 2xx plus `{success:true,id}` with the same UUID. Retry IDs are held only in page memory, not browser storage. Reloading the page discards the retry identity.

The waitlist is shipped as a compiled React bundle without original source. Its small integration patch adds named/labelled inputs, an email fallback, and delegates submit to `window.LeadForms`. If rebuilding the original app later, preserve that integration in source. The shared helper handles submission at document capture phase, including repeat submits, without clearing React-controlled inputs. Do not reintroduce unconditional success on failed requests.

Static forms prevent native submission if the helper fails to load. All forms show a direct email address without relying on the helper. The helper adds current answers to the email link when clicked. No automatic applicant acknowledgment email is promised.
