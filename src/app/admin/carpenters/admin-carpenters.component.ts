import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../session.service';

@Component({
  selector: 'app-admin-carpenters',
  imports: [DatePipe],
  styleUrl: '../admin-pages.css',
  template: `
    <div class="head">
      <h1>Carpenters</h1>
      <input class="search" type="search" placeholder="Search by name, phone or district"
             aria-label="Search carpenters" [value]="query()"
             (input)="query.set($any($event.target).value)" />
    </div>

    @if (all().length === 0) {
      <div class="empty"><p>No carpenters have registered yet.</p></div>
    } @else if (shown().length === 0) {
      <div class="empty"><p>No carpenters match your search.</p></div>
    } @else {
      <p class="count">{{ shown().length }} of {{ all().length }} carpenters</p>
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
          @for (c of shown(); track c.phone) {
            <tr>
              <td data-label="Carpenter">
                <span class="person">
                  <span class="avatar">
                    @if (c.photoUrl) { <img [src]="c.photoUrl" [alt]="c.name" /> } @else { {{ c.name[0] }} }
                  </span>
                  {{ c.name }}
                </span>
              </td>
              <td data-label="Phone">{{ c.phone }}</td>
              <td data-label="Location">{{ c.district }}, {{ c.state }}</td>
              <td data-label="Postal code">{{ c.postalCode }}</td>
              <td data-label="Registered" class="muted">{{ c.registeredAt | date: 'd MMM y, h:mm a' }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class AdminCarpentersComponent {
  readonly all = inject(SessionService).carpenters;
  readonly query = signal('');

  readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return this.all();
    }
    // Phone numbers are matched without spaces or dashes, so "98765 43210" still finds 9876543210.
    const digits = q.replace(/[\s-]/g, '');
    return this.all().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        (digits !== '' && c.phone.includes(digits)),
    );
  });
}
