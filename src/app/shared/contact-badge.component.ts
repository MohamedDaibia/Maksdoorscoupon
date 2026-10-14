import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-contact-badge',
  template: `
    <a class="badge" [class.floating]="floating" [class.corner]="!floating" [class.raised]="raised" href="tel:+919842496525" aria-label="Call 98424 96525">
      <img src="Azar.jpg" alt="Azar" />
      <span class="text"><small>For further queries</small><strong>98424 96525</strong></span>
    </a>
  `,
  styles: [`
    :host { display: contents; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px;
      background: #fff; color: #3b2a1a; text-decoration: none; border-radius: 999px;
      box-shadow: 0 4px 14px rgba(40, 22, 8, .22); white-space: nowrap;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .badge img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #f5b567; }
    .text { display: flex; flex-direction: column; line-height: 1.1; }
    small { font-size: 10px; color: #8a5a1f; letter-spacing: .2px; }
    strong { font-size: 14px; }
    .corner { position: fixed; bottom: 16px; right: 16px; z-index: 6; }
    .corner.raised { bottom: calc(96px + env(safe-area-inset-bottom)); }
    .floating { position: absolute; bottom: 16px; left: 20px; z-index: 5; }
    @media (max-width: 800px) {
      .floating { bottom: 12px; left: 14px; }
      .corner { right: 12px; bottom: 12px; }
      .corner.raised { bottom: calc(92px + env(safe-area-inset-bottom)); }
      .badge img { width: 32px; height: 32px; }
      strong { font-size: 13px; }
    }
  `],
})
export class ContactBadgeComponent {
  @Input() floating = false;
  @Input() raised = false;
}
