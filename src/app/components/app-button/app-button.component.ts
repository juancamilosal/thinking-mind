import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'secondary-filled' | 'success' | 'danger' | 'warning' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-button.component.html',
  styleUrls: ['./app-button.component.css']
})
export class AppButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() rounded: boolean = false; // true for full rounded
  @Input() fullWidth: boolean = false;
  @Input() customClass: string = '';

  @Output() btnClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent) {
    if (!this.disabled && !this.loading) {
      this.btnClick.emit(event);
    }
  }

  getClasses(): string {
    let classes = '';

    // Sizes
    switch (this.size) {
      case 'sm': classes += ' px-3 py-1.5 text-xs'; break;
      case 'md': classes += ' px-4 py-2 text-sm'; break;
      case 'lg': classes += ' px-6 py-3 text-base'; break;
      case 'icon': classes += ' p-2'; break;
    }

    // Rounded
    if (this.rounded) {
      classes += ' rounded-full';
    } else {
      classes += ' rounded-lg';
    }

    // Full Width
    if (this.fullWidth) {
      classes += ' w-full';
    }

    // Variants
    if (this.disabled) {
       classes += ' bg-gray-300 text-gray-500 cursor-not-allowed';
    } else {
       // Only add active:scale-95 if not disabled and not link (link usually doesn't scale like buttons)
       if (this.variant !== 'link') {
         classes += ' active:scale-95';
       }

       switch (this.variant) {
         case 'primary':
           classes += ' bg-[#13486e] text-white hover:bg-[#0f3a5a] shadow-sm';
           break;
         case 'secondary':
           classes += ' bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm';
           break;
         case 'secondary-filled':
           classes += ' bg-gray-100 text-gray-700 hover:bg-gray-200';
           break;
         case 'success':
           classes += ' bg-green-600 text-white hover:bg-green-700 shadow-sm';
           break;
         case 'danger':
           classes += ' bg-red-600 text-white hover:bg-red-700 shadow-sm';
           break;
         case 'warning':
           classes += ' bg-amber-500 text-white hover:bg-amber-600 shadow-sm';
           break;
         case 'ghost':
           classes += ' text-gray-600 hover:text-gray-900 hover:bg-gray-100';
           break;
         case 'link':
           classes += ' text-[#13486e] hover:text-[#0f3a5a] hover:underline px-2 py-1 bg-transparent shadow-none';
           break;
       }
    }

    return `${classes} ${this.customClass}`;
  }
}
