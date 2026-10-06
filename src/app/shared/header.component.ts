import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly user = this.session.user;
  readonly initial = computed(() => {
    const u = this.user();
    return (u?.name?.trim()[0] ?? u?.phone?.[0] ?? '?').toUpperCase();
  });
  readonly menuOpen = signal(false);

  signOut(): void {
    this.menuOpen.set(false);
    this.session.signOut();
    this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    const profile = this.host.nativeElement.querySelector('.profile');
    if (this.menuOpen() && profile && !profile.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
