import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PagerComponent } from '../pager.component';
import { PaymentDrawerComponent } from './payment-drawer.component';
import {
  CouponService,
  CouponState,
  PaymentType,
} from '../../coupon/coupon.service';
import { API_URL } from '../../api.config';
import { AdminCarpenter, AdminCarpentersService } from '../carpenters/admin-carpenters.service';

type Filter = 'all' | 'unclaimed' | 'unpaid' | 'paid';

@Component({
  selector: 'app-admin-coupons',
  imports: [DatePipe, RouterLink, PagerComponent, PaymentDrawerComponent],
  styleUrl: '../admin-pages.css',
  template: `
    <div class="head">
      <h1>Coupons</h1>
    </div>

    <div class="stats">
      <div class="stat"><span class="stat-label">Total</span><span class="stat-value">{{ coupons.dbSummary().total }}</span></div>
      <div class="stat"><span class="stat-label">Unclaimed</span><span class="stat-value">{{ coupons.dbSummary().unclaimed }}</span></div>
      <div class="stat"><span class="stat-label">Unpaid</span><span class="stat-value">{{ coupons.dbSummary().unpaid }}</span></div>
      <div class="stat"><span class="stat-label">Paid</span><span class="stat-value">{{ coupons.dbSummary().paid }}</span></div>
    </div>

    <div class="tabs-bar">
      <div class="tabs" role="tablist" aria-label="Filter coupons">
        @for (t of tabs; track t.key) {
          <button type="button" role="tab" class="tab" [class.active]="!printOpen() && coupons.dbStatus() === t.key"
                  [attr.aria-selected]="!printOpen() && coupons.dbStatus() === t.key" (click)="selectTab(t.key)">
            {{ t.label }}
          </button>
        }
      </div>
      <button type="button" class="print-btn" [class.active]="printOpen()" (click)="openPrint()">Print</button>
    </div>

    @if (printOpen()) {
      <section class="print-panel" aria-label="Print coupons">
        <div class="print-top">
          <button type="button" class="cta" (click)="startPrinting()"
                  [disabled]="printing() || printLoading() || printItems().length === 0">
            {{ printing() ? 'Printing…' : 'Start printing' }}
          </button>
          <button type="button" class="ghost" (click)="closePrint()" [disabled]="printing()">Close</button>
          <span class="print-info">
            {{ printItems().length }} to print now · {{ printTotal() }} unprinted in all
          </span>
        </div>

        @if (printNote()) { <p class="bulk-ok" role="status">{{ printNote() }}</p> }
        @if (printError()) { <p class="error" role="alert">{{ printError() }}</p> }

        @if (printLoading()) {
          <div class="empty"><p>Loading unprinted coupons…</p></div>
        } @else if (printItems().length === 0) {
          <div class="empty"><p>All coupons have been printed.</p></div>
        } @else {
          <div class="print-grid">
            @for (c of printItems(); track c.code) {
              <div class="print-card">
                <img class="print-qr" src="qrcode_coupon.maksdoors.png" alt="QR code" />
                <div class="print-right">
                  <span class="print-hint">Scan QR Code and enter the coupon below</span>
                  <div class="print-text">
                    <strong class="print-code">{{ c.code }}</strong>
                    <span class="print-val">Worth ₹{{ c.value }}</span>
                  </div>
                  <span class="print-url">www.coupon.maksdoors.in</span>
                </div>
              </div>
            }
          </div>
        }
      </section>
    } @else if (coupons.dbError()) {
      <div class="empty"><p role="alert">{{ coupons.dbError() }}</p></div>
    } @else if (rows().length === 0 && coupons.dbLoading()) {
      <div class="empty"><p>Loading coupons…</p></div>
    } @else if (coupons.dbSummary().total === 0) {
      <div class="empty">
        <p>No coupons yet.</p>
        <a class="cta" routerLink="/admin/coupons/add">+ Add Coupon</a>
      </div>
    } @else if (rows().length === 0) {
      <div class="empty">
        <p>{{ emptyMessage() }}</p>
      </div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Coupon number</th>
              <th scope="col">Value</th>
              <th scope="col">Added</th>
              <th scope="col">Added by</th>
              <th scope="col">Claimed by</th>
              <th scope="col">Name</th>
              <th scope="col">Address</th>
              <th scope="col">Paid type</th>
              <th scope="col">Payment status</th>
            </tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.code) {
              <tr class="clickable" tabindex="0" (click)="openDrawer($event, c.code)"
                  (keydown.enter)="openDrawer($event, c.code)">
                <td data-label="Coupon number" class="code">{{ c.code }}</td>
                <td data-label="Value">₹{{ c.value }}</td>
                <td data-label="Added" class="muted">{{ c.createdAt | date: 'd MMM y, h:mm a' }}</td>
                <td data-label="Added by">{{ c.createdBy ?? '-' }}</td>

                <td data-label="Claimed by">
                  @if (c.claimedByPhone) { <strong>{{ c.claimedByPhone }}</strong> } @else { <span class="muted">-</span> }
                </td>

                <td data-label="Name">
                  @if (c.claimedByName) { {{ c.claimedByName }} } @else { <span class="muted">-</span> }
                </td>

                <td data-label="Address">
                  @if (c.claimedByAddress) { {{ c.claimedByAddress }} } @else { <span class="muted">-</span> }
                </td>

                <td data-label="Paid type">
                  @if (c.status === 'Paid') { {{ c.paidType ?? '-' }} } @else { <span class="muted">-</span> }
                </td>

                <td data-label="Payment status">
                  <div class="stack">
                    <span class="badge" [class]="'badge status-' + c.status.toLowerCase()">{{ label(c.status) }}</span>
                    @if (c.status === 'Paid' && c.paidAt) {
                      <span class="muted">{{ c.paidAt | date: 'd MMM y' }}</span>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (selectedRow(); as row) {
        <app-payment-drawer [code]="row.code" [phone]="row.claimedByPhone" [name]="row.claimedByName"
                            [amount]="row.value" [status]="row.status" [paidType]="row.paidType"
                            [paidAt]="row.paidAt" [doorPhotoUrl]="row.doorPhotoUrl" [payError]="payError()" [busy]="paying()"
                            (markPaid)="markPaid(row.code, $event)" (close)="closeDrawer()" />
      }
      <app-pager [page]="coupons.dbPage()" [pageSize]="coupons.dbPageSize()" [total]="coupons.dbTotal()"
                 (pageChange)="coupons.loadAdminCoupons($event)" />
    }
  `,
})
export class AdminCouponsComponent implements OnInit {
  protected readonly coupons = inject(CouponService);
  private readonly http = inject(HttpClient);

  // ---- Print: the next 100 coupons that have never been printed ----
  readonly printOpen = signal(false);
  readonly printItems = signal<{ code: string; value: number }[]>([]);
  readonly printTotal = signal(0);
  readonly printLoading = signal(false);
  readonly printing = signal(false);
  readonly printError = signal('');
  readonly printNote = signal('');
  private readonly carpenterApi = inject(AdminCarpentersService);
  /** Name and address of the carpenters who claimed coupons on this page (asked from the server). */
  private readonly people = signal<AdminCarpenter[]>([]);

  constructor() {
    effect(() => {
      const phones = [...new Set(this.coupons.adminCoupons().map((c) => c.claimedByPhone).filter((p): p is string => !!p))];
      if (phones.length === 0) {
        this.people.set([]);
        return;
      }
      this.carpenterApi.findByPhones(phones).subscribe({
        next: (list) => this.people.set(list),
        error: () => this.people.set([]),
      });
    });
  }

  ngOnInit(): void {
    this.coupons.loadAdminCoupons(1);
  }

  readonly rows = computed(() => {
    const people = new Map(this.people().map((c) => [c.phone, c]));
    return this.coupons.adminCoupons().map((c) => {
      const person = c.claimedByPhone ? people.get(c.claimedByPhone) : undefined;
      return {
        ...c,
        claimedByName: c.claimedByName ?? person?.name ?? '',
        claimedByAddress: person
          ? [person.district, person.state, person.postalCode].filter(Boolean).join(', ')
          : '',
      };
    });
  });

  readonly payError = signal('');
  /** The coupon whose payment methods are open in the side panel. */
  readonly selected = signal<string | null>(null);
  readonly selectedRow = computed(() => this.rows().find((r) => r.code === this.selected()) ?? null);

  /** Row click opens the side panel, unless the click was on the paid-type menu or a button. */
  openDrawer(event: Event, code: string): void {
    if ((event.target as HTMLElement).closest('button, select, option, a')) {
      return;
    }
    this.selected.set(code);
  }
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unclaimed', label: 'Unclaimed' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'paid', label: 'Paid' },
  ];

  openPrint(): void {
    this.closeDrawer();
    this.printNote.set('');
    this.printOpen.set(true);
    this.loadUnprinted();
  }

  closePrint(): void {
    if (this.printing()) {
      return;
    }
    this.printOpen.set(false);
    this.printError.set('');
    this.printNote.set('');
  }

  private loadUnprinted(): void {
    this.printLoading.set(true);
    this.printError.set('');
    this.http
      .get<{ items: { code: string; value: number }[]; total: number }>(`${API_URL}/admin/coupons/unprinted`, {
        params: { count: 120 },
      })
      .subscribe({
        next: (res) => {
          this.printItems.set(res.items);
          this.printTotal.set(res.total);
          this.printLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.printItems.set([]);
          this.printError.set(
            err.status === 0
              ? 'Cannot reach the server. Please check that the API is running.'
              : 'Could not load the coupons to print.',
          );
          this.printLoading.set(false);
        },
      });
  }

  /** Opens the print dialog for the listed coupons, then marks them printed and shows the next unprinted ones. */
  async startPrinting(): Promise<void> {
    const items = this.printItems();
    if (this.printing() || items.length === 0) {
      return;
    }
    this.printing.set(true);
    this.printError.set('');
    this.printNote.set('');

    await this.printCards(items);

    this.http.post<{ marked: number }>(`${API_URL}/admin/coupons/print`, { codes: items.map((i) => i.code) }).subscribe({
      next: (res) => {
        this.printing.set(false);
        this.printItems.set([]); // hide the printed list
        this.printNote.set(`${res.marked} coupons marked as printed.`);
        this.loadUnprinted(); // show what is still unprinted
      },
      error: (err: HttpErrorResponse) => {
        this.printing.set(false);
        this.printError.set(
          (err.error as { error?: string } | null)?.error ?? 'Printed, but the coupons could not be marked as printed. Please try again.',
        );
      },
    });
  }

  /** Prints the cards from a hidden frame (no pop-up to get blocked). Resolves when the print dialog closes. */
  private printCards(items: { code: string; value: number }[]): Promise<void> {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    // A4 page: 2 columns x 10 rows = 20 coupons per page.
    const perPage = 20;
    const qr = new URL('qrcode_coupon.maksdoors.png', document.baseURI).href;
    let pages = '';
    for (let i = 0; i < items.length; i += perPage) {
      const cards = items
        .slice(i, i + perPage)
        .map(
          (c) => `<div class="card"><img class="qr" src="${qr}" alt="">
          <div class="right"><div class="hint">Scan QR Code and enter the coupon below</div>
          <div class="txt"><div class="code">${esc(c.code)}</div><div class="val">Worth ₹${c.value}</div></div>
          <div class="url">www.coupon.maksdoors.in</div></div></div>`,
        )
        .join('');
      pages += `<div class="page"><div class="grid">${cards}</div></div>`;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Maksdoors coupons</title><style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #3b2a1a; }
      .page { height: 277mm; break-after: page; }
      .page:last-child { break-after: auto; }
      .grid { height: 100%; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(10, 1fr); gap: 3mm; }
      .card { border: 1.2px dashed #8a4b14; border-radius: 2mm; padding: 1mm 2mm; gap: 2mm;
              display: flex; flex-direction: row; align-items: center; justify-content: flex-start; overflow: hidden; }
      .right { flex: 1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; padding: .5mm 0; min-width: 0; }
      .hint { font-size: 8px; font-weight: 600; color: #8a4b14; white-space: nowrap; }
      .url { font-size: 9px; font-weight: 700; color: #8a4b14; white-space: nowrap; }
            .qr { height: 23mm; width: 23mm; object-fit: contain; flex: none; }
      .txt { display: flex; flex-direction: column; justify-content: center; min-width: 0; text-align: center; }
      .code { font-size: 22px; font-weight: 900; letter-spacing: 1px; font-family: Consolas, monospace; white-space: nowrap; }
      .val { margin-top: 2px; font-size: 10px; color: #7a6a5a; white-space: nowrap; }
      </style></head><body>${pages}</body></html>`;

    return new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(frame);
      const win = frame.contentWindow!;
      win.document.open();
      win.document.write(html);
      win.document.close();
      // Wait until the QR image has loaded (or failed) so it appears on every coupon.
      const img = win.document.querySelector('img');
      const imgReady = img && !img.complete
        ? new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); })
        : Promise.resolve();
      imgReady.then(() => setTimeout(() => {
        win.focus();
        win.print(); // waits here until the dialog is closed
        frame.remove();
        resolve();
      }, 300));
    });
  }

  /** A tab asks the server for that group of coupons, starting at page 1. */
  selectTab(key: Filter): void {
    if (this.printing()) {
      return;
    }
    this.printOpen.set(false);
    this.closeDrawer();
    this.coupons.loadAdminCoupons(1, this.coupons.dbPageSize(), key);
  }

  /** Unpaid means claimed by a carpenter but not paid yet. */
  label(status: CouponState): string {
    if (status === 'Pending') {
      return 'Unpaid';
    }
    return status === 'Available' ? 'Unclaimed' : status;
  }

  readonly paying = signal(false);

  markPaid(code: string, type: PaymentType): void {
    if (this.paying()) {
      return;
    }
    this.payError.set('');
    this.paying.set(true);
    this.coupons.markPaid(code, type).subscribe((r) => {
      this.paying.set(false);
      if (!r.ok) {
        this.payError.set(r.reason);
      }
    });
  }

  closeDrawer(): void {
    this.selected.set(null);
    this.payError.set('');
  }

  emptyMessage(): string {
    switch (this.coupons.dbStatus()) {
      case 'unclaimed':
        return 'No unclaimed coupons.';
      case 'paid':
        return 'No paid coupons yet.';
      default:
        return 'No unpaid coupons.';
    }
  }
}
