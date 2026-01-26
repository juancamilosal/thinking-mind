import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../core/models/Course';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-meet-student',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meet-student.html',
  styleUrl: './meet-student.css'
})
export class MeetStudent implements OnInit {

  assetsUrl = environment.assets;
  programas: ProgramaAyo[] = [];
  isLoading = false;
  accountsReceivable: any[] = [];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAccountsReceivable();
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }

  loadAccountsReceivable(): void {
    this.isLoading = true;
    const user = StorageServices.getCurrentUser();

    if (user && user.id) {
      this.programaAyoService.getProgramaAyo().subscribe({
        next: (response) => {
          const allPrograms = response.data || [];
          
          // Filter programs where the user is in the students list of the level
          const userPrograms = allPrograms.filter(program => {
            if (program.id_nivel && program.id_nivel.estudiantes_id && Array.isArray(program.id_nivel.estudiantes_id)) {
              return program.id_nivel.estudiantes_id.some((student: any) => student.id === user.id);
            }
            return false;
          });

          // Map to the structure expected by the view (wrapping in an object mimicking account)
          this.accountsReceivable = userPrograms.map(program => ({
            id: program.id, // Use program ID as account ID substitute
            programa_ayo_id: program,
            // Add other fields if necessary, but view mainly uses programa_ayo_id
          }));

          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading programs:', error);
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  getProgramImage(account: any): string {
    const program = account.programa_ayo_id;
    if (program?.img) {
      const imgId = typeof program.img === 'object' ? program.img.id : program.img;
      return `${this.assetsUrl}/${imgId}`;
    }
    if (program?.id_nivel?.imagen) {
      return `${this.assetsUrl}/${program.id_nivel.imagen}`;
    }
    return 'assets/icons/ayo.png';
  }
}
