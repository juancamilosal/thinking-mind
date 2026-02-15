import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-advertising',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './advertising.html'
})
export class Advertising {
}

