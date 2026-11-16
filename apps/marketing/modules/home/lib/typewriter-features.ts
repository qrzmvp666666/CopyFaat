interface FeatureItem {
	title: string;
	subtitle: string;
}

interface LocaleFeatures {
	prefix: string;
	features: FeatureItem[];
}

export const TYPEWRITER_DATA: Record<string, LocaleFeatures> = {
	zh: {
		prefix: "",
		features: [
			{ title: "实时KOL 交易信号", subtitle: "一站追踪 KOL 信号、市场数据与历史表现。" },
		],
	},
	en: {
		prefix: "",
		features: [
			{
				title: "Real-time KOL trading signals",
				subtitle:
					"Track KOL signals, market data, and historical performance in one place.",
			},
		],
	},
	de: {
		prefix: "In einer Stunde dein",
		features: [
			{
				title: "Revolutionäres SaaS",
				subtitle:
					"Alles in einem: Multi-Tenancy, Auth, Zahlungen & Speicher. Bringe dein Produkt Wochen schneller live.",
			},
			{
				title: "Authentifizierungssystem",
				subtitle:
					"Google-, GitHub- & Apple-OAuth, Magic Link, Passkeys und Enterprise-SSO — alles sofort einsatzbereit.",
			},
			{
				title: "Multi-Tenant-App",
				subtitle:
					"Integriertes Organisationsmanagement und Mitgliederrollen für teambasierte SaaS-Produkte.",
			},
			{
				title: "Datenbankdienst",
				subtitle:
					"Supabase / PostgreSQL mit Drizzle ORM für typsichere Abfragen und automatisches Migrationsmanagement.",
			},
			{
				title: "Online-Zahlungen",
				subtitle:
					"Stripe & Lemon Squeezy mit Abonnementplänen, Einmalzahlungen und automatischer Webhook-Verarbeitung.",
			},
			{
				title: "Objektspeicher",
				subtitle:
					"S3, Cloudflare R2 und Supabase Storage für Datei-Upload, Verwaltung und Zugriffskontrolle.",
			},
			{
				title: "Blog & Dokumentation",
				subtitle:
					"MDX-basierter Blog und Doku-Site mit Content Collections, SEO-Optimierung und i18n-Unterstützung.",
			},
			{
				title: "Analytics-Plattform",
				subtitle:
					"PostHog, Google Analytics und Plausible für Nutzerverhalten und Conversion-Analysen.",
			},
		],
	},
	es: {
		prefix: "En una hora, construye tu",
		features: [
			{
				title: "SaaS Revolucionario",
				subtitle:
					"Todo en uno: multi-tenancy, autenticación, pagos y almacenamiento. Lanza tu producto semanas antes.",
			},
			{
				title: "Sistema de Autenticación",
				subtitle:
					"OAuth de Google, GitHub y Apple, Magic Link, Passkeys y SSO empresarial listos para usar.",
			},
			{
				title: "App Multi-inquilino",
				subtitle:
					"Gestión de organizaciones y roles de miembros integrados para productos SaaS colaborativos.",
			},
			{
				title: "Servicio de Base de Datos",
				subtitle:
					"Supabase / PostgreSQL con Drizzle ORM para consultas con tipo seguro y gestión automática de migraciones.",
			},
			{
				title: "Pagos en Línea",
				subtitle:
					"Stripe y Lemon Squeezy con planes de suscripción, pagos únicos y webhooks automáticos.",
			},
			{
				title: "Almacenamiento de Objetos",
				subtitle:
					"S3, Cloudflare R2 y Supabase Storage para carga, gestión y control de acceso de archivos.",
			},
			{
				title: "Blog y Documentación",
				subtitle:
					"Blog y sitio de documentación MDX con colecciones de contenido, SEO y soporte i18n.",
			},
			{
				title: "Plataforma de Analíticas",
				subtitle:
					"Integraciones con PostHog, Google Analytics y Plausible para entender el comportamiento del usuario.",
			},
		],
	},
	fr: {
		prefix: "En une heure, construisez votre",
		features: [
			{
				title: "SaaS Révolutionnaire",
				subtitle:
					"Tout-en-un : multi-tenant, auth, paiements et stockage intégrés. Lancez votre produit des semaines plus vite.",
			},
			{
				title: "Système d'Authentification",
				subtitle:
					"OAuth Google, GitHub et Apple, Magic Link, Passkeys et SSO entreprise — prêts à l'emploi.",
			},
			{
				title: "Application Multi-tenant",
				subtitle:
					"Gestion des organisations et rôles membres intégrés pour des produits SaaS collaboratifs.",
			},
			{
				title: "Service de Base de Données",
				subtitle:
					"Supabase / PostgreSQL avec Drizzle ORM pour des requêtes typées et la gestion automatique des migrations.",
			},
			{
				title: "Paiements en Ligne",
				subtitle:
					"Intégration Stripe et Lemon Squeezy avec abonnements, paiements uniques et webhooks automatiques.",
			},
			{
				title: "Stockage d'Objets",
				subtitle:
					"S3, Cloudflare R2 et Supabase Storage pour l'upload, la gestion et le contrôle d'accès des fichiers.",
			},
			{
				title: "Blog et Documentation",
				subtitle:
					"Blog et site de documentation MDX avec collections de contenu, optimisation SEO et support i18n.",
			},
			{
				title: "Plateforme d'Analytique",
				subtitle:
					"Intégrations PostHog, Google Analytics et Plausible pour comprendre le comportement utilisateur.",
			},
		],
	},
};

export function getTypewriterData(locale: string): LocaleFeatures {
	return TYPEWRITER_DATA[locale] ?? TYPEWRITER_DATA.en;
}
