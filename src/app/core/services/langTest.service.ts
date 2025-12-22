import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { TestQuestion, AnswerOption, TestLanguage } from '../models/LangTestModels';

@Injectable({
	providedIn: 'root'
})
export class LangTestService {
	private readonly apiQuestions = environment.langTest.questions;
	private readonly apiAnswers = environment.langTest.answers;

	constructor(private http: HttpClient) {}

	/**
	 * Fetch up to 10 questions by language with nested answers using Directus relational field `respuestas_id`.
	 */
	getQuestionsByLanguage(language: TestLanguage): Observable<ResponseAPI<TestQuestion[]>> {
		const params: any = {
			fields: '*,respuestas_id.*',
			'filter[idioma][_eq]': language,
			limit: '10',
			sort: 'id'
		};
		return this.http.get<ResponseAPI<TestQuestion[]>>(this.apiQuestions, { params });
	}

	getEnglishQuestions(): Observable<ResponseAPI<TestQuestion[]>> {
		return this.getQuestionsByLanguage('INGLÉS');
	}

	getFrenchQuestions(): Observable<ResponseAPI<TestQuestion[]>> {
		return this.getQuestionsByLanguage('FRANCÉS');
	}

	/**
	 * Fetch answers for a given question by `test_id`.
	 */
	getAnswersByTestId(testId: number): Observable<ResponseAPI<AnswerOption[]>> {
		const params: any = {
			'filter[test_id][_eq]': testId,
			sort: 'id'
		};
		return this.http.get<ResponseAPI<AnswerOption[]>>(this.apiAnswers, { params });
	}
}
