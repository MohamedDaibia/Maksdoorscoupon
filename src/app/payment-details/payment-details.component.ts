import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { API_URL } from '../api.config';
import { HeaderComponent } from '../shared/header.component';
import { SessionService } from '../session.service';

const filled = (c: AbstractControl | null): boolean => !!String(c?.value ?? '').trim();

/**
 * At least one way to be paid is needed: complete bank details (account number, holder name and
 * IFSC), a UPI id, a Google Pay number or a PhonePe number. Bank details are all-or-nothing:
 * starting them without finishing them is an error.
 */
function paymentMethodRequired(group: AbstractControl): ValidationErrors | null {
  const get = (name: string) => group.get(name);
  const bankParts = [get('accountNumber'), get('accountHolderName'), get('ifsc')];
  const bankStarted = bankParts.some(filled) || filled(get('branch'));
  const bankComplete = bankParts.every(filled);

  const errors: ValidationErrors = {};
  if (bankStarted && !bankComplete) {
    errors['bankIncomplete'] = true;
  }
  if (!bankComplete && !filled(get('upiId')) && !filled(get('googlePayNumber')) && !filled(get('phonePeNumber'))) {
    errors['noMethod'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

/**
 * The carpenter's payment settings: bank details and UPI / wallet numbers.
 * Loaded from and saved to the API (PaymentSettings table), tied to the signed-in carpenter.
 * Nothing is kept in the browser, because these details are sensitive.
 */
@Component({
  selector: 'app-payment-details',
  imports: [ReactiveFormsModule, HeaderComponent],
  templateUrl: './payment-details.component.html',
  styleUrl: './payment-details.component.css',
})
export class PaymentDetailsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly user = inject(SessionService).user;
  readonly saved = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');

  readonly form = this.fb.nonNullable.group(
    {
    accountNumber: ['', [Validators.pattern(/^[0-9]{9,18}$/)]],
    accountHolderName: ['', [Validators.maxLength(100)]],
    branch: ['', [Validators.maxLength(100)]],
    ifsc: ['', [Validators.pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)]],
    upiId: ['', [Validators.pattern(/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/)]],
    googlePayNumber: ['', [Validators.pattern(/^[0-9]{10}$/)]],
    phonePeNumber: ['', [Validators.pattern(/^[0-9]{10}$/)]],
    },
    { validators: paymentMethodRequired },
  );

  /** Shown after a failed Save, or once the person has touched a field. */
  readonly submitted = signal(false);

  showMethodError(): boolean {
    return this.form.hasError('noMethod') && (this.submitted() || this.form.dirty);
  }

  showBankError(): boolean {
    return this.form.hasError('bankIncomplete') && (this.submitted() || this.form.dirty);
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  ngOnInit(): void {
    this.http.get<Record<string, string | null>>(`${API_URL}/carpenter/payment-settings`).subscribe({
      next: (res) => {
        this.form.reset({
          accountNumber: res['accountNumber'] ?? '',
          accountHolderName: res['accountHolderName'] ?? '',
          branch: res['branch'] ?? '',
          ifsc: res['ifscCode'] ?? '',
          upiId: res['upiId'] ?? '',
          googlePayNumber: res['googlePayNumber'] ?? '',
          phonePeNumber: res['phonePeNumber'] ?? '',
        });
      },
      error: (err: HttpErrorResponse) =>
        this.loadError.set(
          err.status === 0
            ? 'Cannot reach the server. Please check that the API is running.'
            : 'Could not load your saved payment settings.',
        ),
    });
  }

  onSubmit(): void {
    this.saved.set(false);
    this.saveError.set('');
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.http
      .put(`${API_URL}/carpenter/payment-settings`, {
        accountNumber: v.accountNumber,
        accountHolderName: v.accountHolderName,
        branch: v.branch,
        ifscCode: v.ifsc,
        upiId: v.upiId,
        googlePayNumber: v.googlePayNumber,
        phonePeNumber: v.phonePeNumber,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.saved.set(true);
          this.form.markAsPristine();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.saveError.set(
            err.status === 0
              ? 'Cannot reach the server. Please check that the API is running.'
              : ((err.error as { error?: string } | null)?.error ?? 'Could not save. Please try again.'),
          );
        },
      });
  }
}
