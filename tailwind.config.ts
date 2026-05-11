import type { Config } from "tailwindcss";

export default {
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
			},
			letterSpacing: {
				tighter: '-0.035em',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				positive: {
					DEFAULT: 'hsl(var(--positive))',
					foreground: 'hsl(var(--positive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				reop: {
					teal: 'hsl(var(--reop-teal))',
					'teal-hover': 'hsl(var(--reop-teal-hover))',
					'teal-soft': 'hsl(var(--reop-teal-soft))',
					'dark-blue': 'hsl(var(--reop-dark-blue))',
					'dark-blue-2': 'hsl(var(--reop-dark-blue-2))',
					green: 'hsl(var(--reop-green))',
					'green-soft': 'hsl(var(--reop-green-soft))',
					'hero-stat-bg': 'hsl(var(--reop-hero-stat-bg))',
					'hero-stat-border': 'hsl(var(--reop-hero-stat-border))',
					'hero-eyebrow': 'hsl(var(--reop-hero-eyebrow))',
					'hero-sub': 'hsl(var(--reop-hero-sub))',
					'hero-trend': 'hsl(var(--reop-hero-trend))',
					'warm-soft': 'hsl(var(--reop-warm-soft))',
					'warm-fg': 'hsl(var(--reop-warm-fg))',
					'surface-subtle': 'hsl(var(--reop-surface-subtle))',
					'surface-muted': 'hsl(var(--reop-surface-muted))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'2xl': '1rem'
			},
			boxShadow: {
				'primary-glow': '0 10px 15px -3px hsl(var(--primary) / 0.10), 0 4px 6px -4px hsl(var(--primary) / 0.10)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
