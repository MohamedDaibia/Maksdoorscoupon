import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CarpenterAuthService } from '../auth/carpenter-auth.service';

type FieldName = 'phone' | 'password';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(CarpenterAuthService);

  showPassword = false;
  submitting = false;
  error = '';

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  invalid(field: FieldName): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error = '';
    this.submitting = true;
    const { phone, password } = this.form.getRawValue();
    this.auth.login(phone, password).subscribe((result) => {
      this.submitting = false;
      if (result.ok) {
        this.router.navigateByUrl('/coupon');
      } else {
        this.error = result.reason;
      }
    });
  }
}
