import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { environment } from '../../../../../../environments/environment';
import { NotificationService } from '../../../../../core/services/notification.service';

declare var gapi: any;
declare var google: any;

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

  // Google Calendar Integration
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

  constructor(
    private programaAyoService: ProgramaAyoService,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadAccountsReceivable();
    this.loadGoogleScripts();
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

  // Google Calendar Integration Helpers
  loadGoogleScripts() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => this.gapiLoaded();
    document.body.appendChild(script);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => this.gisLoaded();
    document.body.appendChild(gisScript);
  }

  gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [this.DISCOVERY_DOC],
      });
      this.gapiInited = true;
    });
  }

  gisLoaded() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: '', // defined later
    });
    this.gisInited = true;
  }

  ensureCalendarToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(resp);
        } else {
          // Update gapi client with new token
          if (gapi.client) {
            gapi.client.setToken(resp);
          }
          resolve(resp.access_token);
        }
      };

      // If we don't have a token yet, prompt for consent to ensure we get a valid one
      if (gapi.client.getToken() === null) {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  async addTestParticipants(reunion: any): Promise<void> {
    if (!reunion.id_reunion) {
        console.warn('Meeting has no Google Calendar ID');
        return;
    }

    console.log('Adding test participants to meeting:', reunion.id_reunion);

    try {
        await this.ensureCalendarToken();

        // 1. Get existing event to preserve attendees
        const eventResult = await gapi.client.calendar.events.get({
            calendarId: 'primary',
            eventId: reunion.id_reunion
        });

        const event = eventResult.result;
        const existingAttendees = event.attendees || [];
        const newEmails = ['juancamilosalazarrojas@gmail.com', 'juan.salazar@digitalabus.com'];

        let needsUpdate = false;

        // Process existing attendees: if one of our target emails has 'declined', reset to 'needsAction'
        const updatedAttendees = existingAttendees.map((a: any) => {
            if (newEmails.includes(a.email) && a.responseStatus === 'declined') {
                console.log(`Resetting status for declined participant: ${a.email}`);
                needsUpdate = true;
                return { ...a, responseStatus: 'needsAction' };
            }
            return a;
        });

        // Identify completely new participants
        const newOnes = newEmails.filter(email => 
            !existingAttendees.some((a: any) => a.email === email)
        );

        if (newOnes.length > 0) {
            needsUpdate = true;
            updatedAttendees.push(...newOnes.map(email => ({ email })));
        }

        if (!needsUpdate) {
            console.log('Participants already added and active.');
            this.notificationService.showSuccess('Info', 'Los participantes de prueba ya estaban agregados y activos.');
            return;
        }

        // 2. Patch the event
        await gapi.client.calendar.events.patch({
            calendarId: 'primary',
            eventId: reunion.id_reunion,
            resource: {
                attendees: updatedAttendees
            },
            sendUpdates: 'all'
        });

        this.notificationService.showSuccess('Éxito', 'Participantes de prueba agregados a la reunión.');

    } catch (error) {
        console.error('Error adding participants:', error);
        this.notificationService.showError('Error', 'No se pudieron agregar los participantes de prueba.');
    }
  }

  async handleTestAndJoin(event: Event, reunion: any): Promise<void> {
    event.preventDefault();
    
    // 1. Open window immediately to avoid popup blocker (blank initially)
    let win: Window | null = null;
    if (reunion.link_reunion) {
        win = window.open('', '_blank');
    }

    try {
        // 2. Run the manual test (add participants to hardcoded meeting) and WAIT
        await this.runManualTest();
        
        // 3. Also add participants to the CURRENT meeting (if different) and WAIT
        if (reunion.id_reunion) {
             await this.addTestParticipants(reunion);
        }

    } catch (error) {
        console.error('Error adding participants during join:', error);
    }

    // 4. Redirect the window to the meeting link
    if (win && reunion.link_reunion) {
        win.location.href = reunion.link_reunion;
    }
  }

  handleMeetingClick(event: Event, reunion: any): void {
    event.preventDefault();
    console.log('Meeting click detected for:', reunion.id_reunion);
    
    // 1. Open Meet in new tab immediately
    if (reunion.link_reunion) {
        window.open(reunion.link_reunion, '_blank');
    }

    // 2. Add participants in background
    this.addTestParticipants(reunion);
  }

  async runManualTest(): Promise<void> {
    const meetingId = 't1gbfhg098u82gr79kashf95sg';
    console.log('Running manual test for meeting:', meetingId);
    
    // Create a mock reunion object with the specific ID
    const mockReunion = {
        id_reunion: meetingId
    };
    
    await this.addTestParticipants(mockReunion);
  }
}
