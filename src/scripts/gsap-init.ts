import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initHeader() {
	const header = document.querySelector<HTMLElement>('[data-header]');
	if (!header) return;

	ScrollTrigger.create({
		start: 'top -80',
		onUpdate: (self) => {
			header.classList.toggle('is-scrolled', self.scroll() > 40);
		},
	});

	gsap.from('[data-logo]', {
		opacity: 0,
		x: -16,
		duration: 0.7,
		ease: 'power3.out',
	});

	gsap.from('[data-nav-link]', {
		opacity: 0,
		y: -8,
		duration: 0.5,
		stagger: 0.06,
		delay: 0.15,
		ease: 'power2.out',
	});
}

function initHero() {
	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.from('[data-hero-eyebrow]', { opacity: 0, y: 20, duration: 0.6 })
		.from(
			'[data-hero-title]',
			{ opacity: 0, y: 48, duration: 0.9, skewY: 2 },
			'-=0.35',
		)
		.from('[data-hero-subtitle]', { opacity: 0, y: 24, duration: 0.7 }, '-=0.5')
		.from('[data-hero-cta]', { opacity: 0, y: 16, duration: 0.5, stagger: 0.1 }, '-=0.4')
		.from('[data-hero-visual]', { opacity: 0, scale: 0.92, duration: 1 }, '-=0.8');
}

function initHomeExtras() {
	gsap.to('[data-orbit]', {
		rotation: 360,
		duration: 24,
		repeat: -1,
		ease: 'none',
		transformOrigin: '50% 50%',
	});

	gsap.from('[data-stat]', {
		opacity: 0,
		y: 24,
		duration: 0.6,
		stagger: 0.12,
		scrollTrigger: {
			trigger: '[data-stats]',
			start: 'top 85%',
		},
	});
}

function initScrollAnimations() {
	gsap.utils.toArray<HTMLElement>('[data-animate]').forEach((el) => {
		gsap.from(el, {
			opacity: 0,
			y: 24,
			duration: 0.8,
			ease: 'power2.out',
			scrollTrigger: {
				trigger: el,
				start: 'top 88%',
				toggleActions: 'play none none reverse',
			},
		});
	});

	gsap.utils.toArray<HTMLElement>('[data-card]').forEach((card, i) => {
		gsap.from(card, {
			opacity: 0,
			y: 40,
			duration: 0.7,
			delay: (i % 3) * 0.08,
			ease: 'power2.out',
			scrollTrigger: {
				trigger: card,
				start: 'top 90%',
			},
		});
	});

	gsap.utils.toArray<HTMLElement>('[data-line]').forEach((line) => {
		gsap.from(line, {
			scaleX: 0,
			transformOrigin: 'left center',
			duration: 0.8,
			ease: 'power2.inOut',
			scrollTrigger: {
				trigger: line,
				start: 'top 85%',
			},
		});
	});
}

function initPageTransition() {
	document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((link) => {
		link.addEventListener('click', (e) => {
			const url = link.getAttribute('href');
			if (!url || url.startsWith('#') || link.target === '_blank') return;
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

			const dest = new URL(url, window.location.origin);
			if (dest.origin !== window.location.origin) return;
			if (dest.pathname === window.location.pathname) return;

			e.preventDefault();
			gsap.to('main', {
				opacity: 0,
				y: -12,
				duration: 0.25,
				ease: 'power2.in',
				onComplete: () => {
					window.location.href = dest.pathname + dest.search;
				},
			});
		});
	});

	gsap.from('main', { opacity: 0, y: 16, duration: 0.45, ease: 'power2.out', delay: 0.05 });
}

function init() {
	if (prefersReducedMotion()) {
		gsap.set('[data-animate], [data-card], [data-hero-title], [data-hero-subtitle]', {
			opacity: 1,
			clearProps: 'all',
		});
		return;
	}

	initHeader();
	initHero();
	initScrollAnimations();
	initPageTransition();

	if (document.querySelector('[data-home]')) {
		initHomeExtras();
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
