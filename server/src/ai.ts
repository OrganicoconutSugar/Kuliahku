import type { Recap } from './insights'
export interface AIProvider {
  generateSummary(input: Recap): Promise<{ text: string }>
  generateQuiz(input: {
    notes: { title: string; body: string }[]
    count: number
  }): Promise<{ questions: string[] }>
}
export class NoopProvider implements AIProvider {
  async generateSummary(_input: Recap): Promise<never> {
    throw new Error('Provider AI belum dikonfigurasi.')
  }
  async generateQuiz(_input: {
    notes: { title: string; body: string }[]
    count: number
  }): Promise<never> {
    throw new Error('Provider AI belum dikonfigurasi.')
  }
}
