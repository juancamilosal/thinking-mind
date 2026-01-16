import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';

declare var gapi: any;
declare var google: any;

@Component({
    selector: 'app-entry-validation',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './entry-validation.html',
    styleUrls: ['./entry-validation.css']
})
export class EntryValidation implements OnInit {
    entryForm!: FormGroup;
    meetingForm!: FormGroup;
    documentTypes = DOCUMENT_TYPE;
    participants: string[] = [];
    lastCreatedEventId: string | null = null;

    private readonly CLIENT_ID = '996133721948-6rim847cd71sknq58u3tcov5drtag7vv.apps.googleusercontent.com';
    private readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    private readonly SCOPES = 'https://www.googleapis.com/auth/calendar.events';

    tokenClient: any;
    gapiInited = false;
    gisInited = false;

    private pendingAction: (() => void) | null = null;

    constructor(private formBuilder: FormBuilder) { }

    ngOnInit(): void {
        this.loadGoogleScripts();

        this.entryForm = this.formBuilder.group({
            documentType: ['', Validators.required],
            documentNumber: ['', [Validators.required, Validators.pattern("^[0-9]*$")]],
            email: ['', [Validators.required, Validators.email]],
            codeConfirmation: ['', Validators.required]
        });

        this.meetingForm = this.formBuilder.group({
            summary: ['', Validators.required],
            description: [''],
            startDateTime: ['', Validators.required],
            endDateTime: ['', Validators.required],
            participantEmail: ['', Validators.email]
        });
    }

    loadGoogleScripts() {
        const scriptGapi = document.createElement('script');
        scriptGapi.src = 'https://apis.google.com/js/api.js';
        scriptGapi.onload = () => this.gapiLoaded();
        scriptGapi.onerror = (err) => console.error('Error loading GAPI script', err);
        document.body.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = 'https://accounts.google.com/gsi/client';
        scriptGis.onload = () => this.gisLoaded();
        scriptGis.onerror = (err) => console.error('Error loading GIS script', err);
        document.body.appendChild(scriptGis);
    }

    gapiLoaded() {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [this.DISCOVERY_DOC],
                });
                this.gapiInited = true;
                console.log('GAPI Client Initialized');
            } catch (error) {
                console.error('Error initializing GAPI Client', error);
                alert('Error al inicializar los servicios de Google. Revisa la consola.');
            }
        });
    }

    gisLoaded() {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                ux_mode: 'popup',
                callback: (resp: any) => {
                    if (resp.error !== undefined) {
                        console.error('OAuth Error', resp);
                        alert('Error de autenticación: ' + resp.error);
                        return;
                    }
                    console.log('OAuth Success');
                    if (this.pendingAction) {
                        this.pendingAction();
                        this.pendingAction = null;
                    }
                },
            });
            this.gisInited = true;
            console.log('GIS Client Initialized');
        } catch (error) {
            console.error('Error initializing GIS Client', error);
        }
    }

    addParticipant() {
        const emailControl = this.meetingForm.get('participantEmail');
        if (emailControl?.valid && emailControl.value) {
            if (!this.participants.includes(emailControl.value)) {
                this.participants.push(emailControl.value);
            }
            emailControl.reset();
        }
    }

    removeParticipant(index: number) {
        this.participants.splice(index, 1);
    }

    async createMeeting() {
        // Auto-add participant if user forgot to click add button
        const emailControl = this.meetingForm.get('participantEmail');
        if (emailControl?.value && emailControl.valid) {
            this.addParticipant();
        }

        console.log('Attempting to create meeting...');

        if (this.meetingForm.invalid) {
            console.warn('Form is invalid', this.meetingForm.errors);
            this.meetingForm.markAllAsTouched();
            return;
        }

        if (!this.gapiInited || !this.gisInited) {
            console.error('Google APIs not initialized', { gapi: this.gapiInited, gis: this.gisInited });
            alert('Los servicios de Google aún no están listos. Por favor, espera unos segundos e intenta nuevamente.');
            return;
        }

        this.pendingAction = () => this.createCalendarEvent();

        if (gapi.client.getToken() === null) {
            console.log('Requesting Access Token (Consent)...');
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            console.log('Requesting Access Token (Skip Consent)...');
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    async createCalendarEvent() {
        const startDate = new Date(this.meetingForm.value.startDateTime);
        const endDate = new Date(this.meetingForm.value.endDateTime);

        if (endDate <= startDate) {
            alert('Error: La fecha de finalización debe ser posterior a la fecha de inicio.');
            console.error('Date validation failed', { start: startDate, end: endDate });
            return;
        }

        const event = {
            summary: this.meetingForm.value.summary,
            description: this.meetingForm.value.description,
            start: {
                dateTime: startDate.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            attendees: this.participants.map(email => ({ email })),
            conferenceData: {
                createRequest: {
                    requestId: "req-" + Date.now(),
                    conferenceSolutionKey: { type: "hangoutsMeet" }
                }
            }
        };

        console.log('Event Data:', event);

        try {
            const request = await gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1
            });

            console.log('Event created successfully:', request);
            this.lastCreatedEventId = request.result.id;
            alert('Evento creado exitosamente con Google Meet: ' + request.result.htmlLink);
            this.meetingForm.reset();
            this.participants = [];
        } catch (err: any) {
            console.error('Error executing calendar.events.insert', err);
            let errorMessage = 'Error al crear el evento.';
            if (err.result && err.result.error && err.result.error.message) {
                errorMessage += ' ' + err.result.error.message;
            }
            alert(errorMessage);
        }
    }

    async addParticipantToLastEvent(newEmail: string) {
        if (!this.lastCreatedEventId) {
            alert('No hay un evento creado recientemente para editar.');
            return;
        }
        await this.addParticipantToAnyEvent(this.lastCreatedEventId, newEmail);
    }

    async addParticipantToAnyEvent(eventId: string, email: string) {
        if (!eventId || !email) {
            alert('Por favor ingrese el ID del evento y el correo del participante.');
            return;
        }

        const action = async () => {
            try {
                // 1. Get current event
                const getRequest = await gapi.client.calendar.events.get({
                    calendarId: 'primary',
                    eventId: eventId
                });

                const currentEvent = getRequest.result;
                const currentAttendees = currentEvent.attendees || [];

                // 2. Check if already exists
                if (currentAttendees.some((a: any) => a.email === email)) {
                    alert('Este participante ya está en el evento.');
                    return;
                }

                // 3. Add new attendee
                const updatedAttendees = [...currentAttendees, { email: email }];

                // 4. Patch the event
                const patchRequest = await gapi.client.calendar.events.patch({
                    calendarId: 'primary',
                    eventId: eventId,
                    resource: {
                        attendees: updatedAttendees
                    }
                });

                console.log('Event updated:', patchRequest);
                alert(`Participante ${email} agregado exitosamente al evento ${eventId}.`);

            } catch (err: any) {
                console.error('Error updating event', err);
                alert('Error al actualizar el evento: ' + (err.result?.error?.message || err.message));
            }
        };

        if (gapi.client.getToken() === null) {
            console.log('Token missing, requesting access...');
            this.pendingAction = action;
            this.tokenClient.requestAccessToken({ prompt: '' });
        } else {
            await action();
        }
    }

    onSubmit() {
        if (this.entryForm.valid) {
            console.log('Form Submitted', this.entryForm.value);
        } else {
            this.entryForm.markAllAsTouched();
        }
    }
}
