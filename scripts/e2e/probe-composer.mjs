import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

const info = await evaluate(client, `(() => {
  const tas = [...document.querySelectorAll('textarea')].map((t,i)=>({
    i,
    cls: t.className,
    ph: t.placeholder,
    valueLen: (t.value||'').length,
    disabled: t.disabled,
    rect: t.getBoundingClientRect().toJSON()
  }));
  const buttons = [...document.querySelectorAll('.composer-bar button, .composer button, button')].slice(0,40).map(b=>({
    aria: b.getAttribute('aria-label'),
    cls: b.className,
    type: b.type,
    text: (b.textContent||'').trim().slice(0,20),
    disabled: b.disabled
  }));
  const bar = document.querySelector('.composer-bar');
  return {
    tas,
    buttonCount: document.querySelectorAll('button').length,
    composerButtons: buttons.filter(b => b.aria || /send|发送|cb-/.test(b.cls||'') || /↑|send/i.test(b.text||'')),
    barHtml: bar ? bar.outerHTML.slice(0, 1500) : null,
    hasCts: !!document.getElementById('cts-token-status')
  };
})()`);
console.log(JSON.stringify(info, null, 2));

// Inspect React fiber on textarea for submit handler
const fiberInfo = await evaluate(client, `(() => {
  const ta = document.querySelector('textarea.composer-input') || document.querySelector('textarea');
  if (!ta) return {err:'no ta'};
  const key = Object.keys(ta).find(k=>k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
  const propsKey = Object.keys(ta).find(k=>k.startsWith('__reactProps$'));
  const props = propsKey ? ta[propsKey] : null;
  return {
    key,
    propsKeys: props ? Object.keys(props) : null,
    hasOnChange: !!(props && props.onChange),
    hasOnKeyDown: !!(props && props.onKeyDown),
    hasOnSubmit: !!(props && props.onSubmit),
  };
})()`);
console.log("fiber", JSON.stringify(fiberInfo, null, 2));

client.close();
