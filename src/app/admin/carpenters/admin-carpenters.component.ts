import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PagerComponent } from '../pager.component';
import { AdminCarpentersService, CarpenterClaim } from './admin-carpenters.service';

@Component({
  selector: 'app-admin-carpenters',
  imports: [DatePipe, PagerComponent],
  styleUrl: '../admin-pages.css',
  template: `
    <div class="head">
      <h1>Carpenters</h1>
      <input class="search" type="search" placeholder="Search by name, phone or district"
             aria-label="Search carpenters" [value]="query()"
             (input)="onSearch($any($event.target).value)" />
    </div>

    @if (error()) {
      <div class="empty"><p role="alert">{{ error() }}</p></div>
    } @else if (all().length === 0 && loading()) {
      <div class="empty"><p>Loading carpenters…</p></div>
    } @else if (all().length === 0) {
      <div class="empty"><p>{{ query().trim() ? 'No carpenters match your search.' : 'No carpenters have registered yet.' }}</p></div>
    } @else {
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Carpenter</th>
            <th scope="col">Phone</th>
            <th scope="col">Location</th>
            <th scope="col">Postal code</th>
            <th scope="col">Registered</th>
          </tr>
        </thead>
        <tbody>
          @for (c of all(); track c.phone) {
            <tr class="clickable" [class.open]="selected() === c.phone" tabindex="0"
                role="button" [attr.aria-expanded]="selected() === c.phone"
                (click)="toggle(c.phone)" (keydown.enter)="toggle(c.phone)">
              <td data-label="Carpenter">
                <span class="person">
                  <span class="avatar">
                    @if (c.photoUrl) { <img [src]="c.photoUrl" [alt]="c.name" /> } @else { {{ c.name.charAt(0) }} }
                  </span>
                  {{ c.name }}
                </span>
              </td>
              <td data-label="Phone">{{ c.phone }}</td>
              <td data-label="Location">{{ c.district }}{{ c.district && c.state ? ', ' : '' }}{{ c.state }}</td>
              <td data-label="Postal code">{{ c.postalCode }}</td>
              <td data-label="Registered" class="muted">{{ c.registeredAt | date: 'd MMM y, h:mm a' }}</td>
            </tr>
            @if (selected() === c.phone) {
              <tr class="detail">
                <td colspan="5">
                  <strong>Coupons claimed by {{ c.name }}</strong>
                  @if (claimsLoading()) {
                    <p class="muted">Loading coupons…</p>
                  } @else if (claimsError()) {
                    <p class="muted" role="alert">{{ claimsError() }}</p>
                  } @else if (claims().length === 0) {
                    <p class="muted">No coupons claimed yet.</p>
                  } @else {
                    <table class="table inner">
                      <thead>
                        <tr>
                          <th scope="col">Coupon number</th>
                          <th scope="col">Value</th>
                          <th scope="col">Claimed</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (k of claims(); track k.code) {
                          <tr>
                            <td data-label="Coupon number" class="code">{{ k.code }}</td>
                            <td data-label="Value">₹{{ k.value }}</td>
                            <td data-label="Claimed" class="muted">{{ k.claimedAt | date: 'd MMM y, h:mm a' }}</td>
                            <td data-label="Status">
                              <span class="badge" [class]="'badge status-' + k.status.toLowerCase()">
                                {{ k.status === 'Pending' ? 'Unpaid' : k.status }}
                              </span>
                              @if (k.status === 'Paid' && k.paidVia) { <span class="muted"> {{ k.paidVia }}</span> }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
      <app-pager [page]="service.page()" [pageSize]="service.pageSize()" [total]="service.total()"
                 (pageChange)="load($event)" />
    }
  `,
})
export class AdminCarpentersComponent implements OnInit {
  protected readonly service = inject(AdminCarpentersService);
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly all = this.service.carpenters;
  readonly loading = this.service.loading;
  readonly error = this.service.error;
  readonly query = signal('');
  readonly selected = signal<string | null>(null);

  /** The coupons claimed by the open carpenter. They are fetched when the row is clicked, not before. */
  readonly claims = signal<CarpenterClaim[]>([]);
  readonly claimsLoading = signal(false);
  readonly claimsError = signal('');

  toggle(phone: string): void {
    if (this.selected() === phone) {
      this.selected.set(null);
      return;
    }
    this.selected.set(phone);
    this.claims.set([]);
    this.claimsError.set('');
    this.claimsLoading.set(true);
    this.service.claims(phone).subscribe({
      next: (list) => {
        if (this.selected() !== phone) return; // another row was opened meanwhile
        this.claims.set(list);
        this.claimsLoading.set(false);
      },
      error: () => {
        if (this.selected() !== phone) return;
        this.claimsError.set('Could not load the claimed coupons.');
        this.claimsLoading.set(false);
      },
    });
  }

  ngOnInit(): void {
    this.service.load('', 1);
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.selected.set(null);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 300); // wait for a pause in typing, then ask the server
  }

  load(page: number): void {
    this.selected.set(null);
    this.service.load(this.query(), page);
  }
}
