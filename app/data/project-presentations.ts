import source from './project-presentations.json';

export type PresentationImage = { src: string; alt: string; caption: string; kind: 'photo' | 'model' | 'drawing' };
export type PresentationModel = { src: string; bytes: number; label: string; upAxis: 'y' | 'z'; layers?: 'isil-villa' };
export type ProjectPresentation = {
  slug: string; title: string; category: string; summary: string; description: string[];
  cover: PresentationImage; gallery: PresentationImage[]; scopeNote: string; package: string;
  facts: { label: string; value: string }[]; origin?: string; tags?: string[];
  model?: PresentationModel; additionalModels?: PresentationModel[]; modelNotice?: string; featured?: boolean;
};
export const projectPresentations = source as ProjectPresentation[];
export const getProjectPresentation = (slug: string) => projectPresentations.find(project => project.slug === slug);
export const presentationKindLabel = (kind: PresentationImage['kind']) => kind === 'photo' ? 'Saha kaydı' : kind === 'drawing' ? 'Proje çizimi' : '3B sunum';

