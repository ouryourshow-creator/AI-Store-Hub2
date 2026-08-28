import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, Tag, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import Layout from '../components/Layout';
import { useLang } from '../contexts/LanguageContext';

export default function AboutPage() {
  const { t, dir } = useLang();
  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const highlights = [
    { icon: Tag, label: t('aboutBestPrices') },
    { icon: Zap, label: t('aboutFastDelivery') },
    { icon: Headphones, label: t('aboutRealSupport') },
  ];

  return (
    <Layout>
      <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-16" dir={dir}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <BackArrow className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t('backToStore')}
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full mb-5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('aboutBrand')}
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-6">
            {t('aboutTitle')}
          </h1>
          <p className="text-muted-foreground text-lg leading-9">
            {t('aboutIntro')}
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-14"
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground text-center mb-7">
            {t('aboutFocusTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {highlights.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="bg-card rounded-2xl border border-black/[0.06] p-6 text-center shadow-sm"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 bg-card rounded-[24px] border border-black/[0.06] shadow-sm p-7 md:p-10 text-center"
        >
          <p className="text-muted-foreground text-lg leading-9 font-semibold">
            {t('aboutDetails')}
          </p>
          <p className="mt-6 text-foreground text-lg leading-9 font-semibold">
            {t('aboutGoal')}
          </p>
        </motion.section>

        <motion.footer
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 rounded-[24px] bg-gradient-to-br from-secondary to-primary p-8 md:p-10 text-center text-white"
        >
          <p className="font-display text-2xl font-bold">{t('aboutBrand')}</p>
          <p className="mt-2 text-white/80 text-lg">{t('aboutTagline')}</p>
        </motion.footer>
      </div>
    </Layout>
  );
}