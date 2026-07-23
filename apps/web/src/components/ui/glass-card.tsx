'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

type GlassCardProps = HTMLMotionProps<'div'> & { hoverable?: boolean };

export function GlassCard({ className, hoverable = true, children, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={clsx('glass-card p-5', className)}
      whileHover={hoverable ? { y: -2, transition: { duration: 0.2 } } : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
