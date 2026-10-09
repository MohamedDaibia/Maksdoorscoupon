import { Component, computed, input, output } from '@angular/core';

/** Previous / Next with page numbers. The parent loads the page the server should return. */
@Component({
  selector: 'app-pager',
  template: `
    @if (total() > 0) {
      <nav class="pager" aria-label="Pagination">
        <span class="info">{{ from() }}-{{ to() }} of {{ total() }}</span>
        <button type="button" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">Previous</button>
        @for (n of pages(); track n) {
          <button type="button" [class.active]="n === page()" [attr.aria-current]="n === page() ? 'page' : null"
                  (click)="pageChange.emit(n)">{{ n }}</button>
        }
        <button type="button" [disabled]="page() >= last()" (click)="pageChange.emit(page() + 1)">Next</button>
      </nav>
    }
  `,
  styles: `
    .pager { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; }
    .info { margin-right: auto; font-size: 12px; color: #7a6a5a; }
    button {
      min-width: 30px; padding: 4px 9px; border: 1.5px solid #dccfbf; border-radius: 8px;
      background: #fff; color: #2a1d12; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    button:hover:not(:disabled) { background: #f6efe6; }
    button.active { background: #b9722d; border-color: #b9722d; color: #fff; }
    button:disabled { opacity: .45; cursor: default; }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly last = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  /** Up to five page numbers around the current page. */
  readonly pages = computed(() => {
    const last = this.last();
    const start = Math.max(1, Math.min(this.page() - 2, last - 4));
    const end = Math.min(last, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });
}
