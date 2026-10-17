// MODO DEMOSTRACIÓN (solo rama de pruebas): simulador del checkout de Wompi y panel de ayuda.
import { environment } from '../../environments/environment';
import { DEMO_HINTS, loadDb, nextId, nowBogota, resetDb, saveDb } from './demo-data';

// Las imágenes de los programas de prueba se sirven desde los assets locales
(environment as any).assets = '/assets/demo';

const METHODS = [
  { id: 'CARD', label: 'Tarjeta' },
  { id: 'PSE', label: 'PSE' },
  { id: 'NEQUI', label: 'Nequi' },
];

function money(value: number): string {
  return '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function el(tag: string, style: string, html = ''): HTMLElement {
  const node = document.createElement(tag);
  node.setAttribute('style', style);
  node.innerHTML = html;
  return node;
}

// Reemplaza window.WidgetCheckout con un checkout simulado que registra el pago en los datos de prueba
class DemoWidgetCheckout {
  constructor(private config: any) {}

  open(callback: (result: any) => void): void {
    const amount = Math.round((this.config?.amountInCents || 0) / 100);
    const reference: string = this.config?.reference || '';
    const payer: string = this.config?.customerData?.fullName || 'Acudiente';
    let method = 'CARD';

    const overlay = el('div', 'position:fixed;inset:0;z-index:10000;background:rgba(14,26,71,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Plus Jakarta Sans,Poppins,sans-serif;');
    const card = el('div', 'background:#fff;border-radius:20px;max-width:380px;width:100%;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3);');
    card.appendChild(el('div', 'background:#2c2a29;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;',
      '<strong style="font-size:15px;">Wompi · Pago de prueba</strong><span style="font-size:11px;background:#b0f2ae;color:#2c2a29;padding:3px 8px;border-radius:999px;font-weight:700;">SIMULACIÓN</span>'));

    const body = el('div', 'padding:20px;color:#14245c;');
    body.appendChild(el('p', 'margin:0;font-size:12px;color:#7b859f;', 'Total a pagar'));
    body.appendChild(el('p', 'margin:2px 0 4px;font-size:28px;font-weight:800;', money(amount)));
    body.appendChild(el('p', 'margin:0 0 16px;font-size:11px;color:#7b859f;word-break:break-all;', 'Referencia: ' + reference));
    body.appendChild(el('p', 'margin:0 0 8px;font-size:12px;font-weight:700;', 'Medio de pago'));

    const methods = el('div', 'display:flex;gap:8px;margin-bottom:18px;');
    const buttons: HTMLElement[] = [];
    const paint = () => buttons.forEach(b => {
      const active = b.dataset['method'] === method;
      b.style.borderColor = active ? '#14245c' : '#d5dbe6';
      b.style.background = active ? '#e6eaf5' : '#fff';
    });
    METHODS.forEach(m => {
      const b = el('button', 'flex:1;padding:9px 0;border:1.5px solid #d5dbe6;border-radius:10px;font-size:13px;font-weight:600;color:#14245c;cursor:pointer;background:#fff;', m.label);
      b.dataset['method'] = m.id;
      b.onclick = () => { method = m.id; paint(); };
      buttons.push(b);
      methods.appendChild(b);
    });
    paint();
    body.appendChild(methods);

    const status = el('p', 'display:none;margin:0 0 12px;font-size:13px;font-weight:600;text-align:center;color:#14245c;', 'Procesando pago...');
    body.appendChild(status);

    const approve = el('button', 'width:100%;padding:12px;border:none;border-radius:12px;background:#1e7b3c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px;', 'Aprobar pago');
    const reject = el('button', 'width:100%;padding:12px;border:1.5px solid #b3261e;border-radius:12px;background:#fff;color:#b3261e;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px;', 'Rechazar pago');
    const cancel = el('button', 'width:100%;padding:10px;border:none;background:none;color:#7b859f;font-size:13px;cursor:pointer;', 'Cancelar');
    body.appendChild(approve);
    body.appendChild(reject);
    body.appendChild(cancel);
    body.appendChild(el('p', 'margin:10px 0 0;font-size:11px;color:#7b859f;text-align:center;', 'Modo demostración: no se realiza ningún cobro real.'));
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const finish = (approved: boolean) => {
      approve.setAttribute('disabled', 'true');
      reject.setAttribute('disabled', 'true');
      status.style.display = 'block';
      setTimeout(() => {
        const db = loadDb();
        // La referencia es: <id cuenta>-<DDMMYYYY>-<4 dígitos>
        const accountId = reference.split('-').slice(0, -2).join('-');
        const account = db.cuentas.find(c => c.id === accountId);
        const transaction = `${Math.floor(10000 + Math.random() * 89999)}-${Math.floor(1 + Math.random() * 9)}`;
        if (account) {
          account.pagos.push({
            id: nextId(db, 'demo-pago'), valor: amount, fecha_pago: nowBogota(), metodo_pago: method,
            pagador: payer, numero_transaccion: transaction, estado: approved ? 'PAGADO' : 'RECHAZADO',
          });
          saveDb(db);
        }
        overlay.remove();
        callback({ transaction: { id: transaction, status: approved ? 'APPROVED' : 'DECLINED' } });
      }, 1200);
    };
    approve.onclick = () => finish(true);
    reject.onclick = () => finish(false);
    cancel.onclick = () => overlay.remove();
  }
}

function mountPanel(): void {
  const wrap = el('div', 'position:fixed;left:12px;bottom:12px;z-index:9999;font-family:Plus Jakarta Sans,Poppins,sans-serif;');
  const pill = el('button', 'background:#d4461a;color:#fff;border:none;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer;', 'Modo demostración');
  const panel = el('div', 'display:none;margin-bottom:8px;width:270px;background:#fff;color:#14245c;border-radius:16px;padding:14px;box-shadow:0 12px 30px rgba(14,26,71,.25);border:1px solid #e2e7f0;font-size:12px;');
  panel.innerHTML =
    '<p style="margin:0 0 4px;font-weight:800;font-size:13px;">Datos de prueba</p>' +
    '<p style="margin:0 0 10px;color:#7b859f;">Nada se guarda en el sistema real. Los pagos se simulan.</p>' +
    DEMO_HINTS.map(h => `<p style="margin:0 0 6px;"><span style="color:#7b859f;">${h.label}</span><br><strong>${h.value}</strong></p>`).join('') +
    '<p style="margin:8px 0 10px;color:#7b859f;">Colegios: San José, Los Andes, Santa María.</p>';
  const reset = el('button', 'width:100%;padding:8px;border:1.5px solid #14245c;border-radius:10px;background:#fff;color:#14245c;font-weight:700;font-size:12px;cursor:pointer;', 'Reiniciar datos de prueba');
  reset.onclick = () => {
    if (confirm('¿Reiniciar los datos de prueba? Se borrarán las inscripciones y pagos simulados.')) {
      resetDb();
      location.reload();
    }
  };
  panel.appendChild(reset);
  pill.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  wrap.appendChild(panel);
  wrap.appendChild(pill);
  document.body.appendChild(wrap);

  // En móvil la página tiene una barra fija abajo: subir el botón para no taparla
  const adjust = () => { wrap.style.bottom = window.innerWidth < 1024 ? '84px' : '12px'; };
  adjust();
  window.addEventListener('resize', adjust);
}

export function setupDemoMode(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  (window as any).WidgetCheckout = DemoWidgetCheckout;
  // Si el script real de Wompi termina de cargar después, se vuelve a reemplazar
  window.addEventListener('load', () => { (window as any).WidgetCheckout = DemoWidgetCheckout; });
  mountPanel();
}
