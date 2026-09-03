import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollText, ShieldCheck, UserCheck, Lock, AlertTriangle, Brain, Database, Copyright, EyeOff, Server, Activity, Scale, RefreshCw, XCircle, Gavel, Sparkles, Phone } from 'lucide-react';

const SESSION_KEY = 'ledgerlm_terms_accepted_session';

interface TermsAndConditionsModalProps {
  open?: boolean;
  onClose?: () => void;
}

export function TermsAndConditionsModal({ open: controlledOpen, onClose }: TermsAndConditionsModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (controlledOpen === undefined && !sessionStorage.getItem(SESSION_KEY)) {
      setInternalOpen(true);
    }
  }, [controlledOpen]);

  // Reset checkbox whenever modal opens
  useEffect(() => {
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    if (isOpen) setAcknowledged(false);
  }, [controlledOpen, internalOpen]);

  const isViewOnly = controlledOpen !== undefined;
  const open = isViewOnly ? controlledOpen : internalOpen;

  const handleAccept = () => {
    if (isViewOnly) {
      onClose?.();
    } else {
      sessionStorage.setItem(SESSION_KEY, '1');
      setInternalOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[600px] w-full p-0 gap-0 overflow-hidden rounded-2xl [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => { if (!isViewOnly) e.preventDefault(); }}
        onInteractOutside={(e) => { if (!isViewOnly) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!isViewOnly) e.preventDefault(); else handleAccept(); }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-4 px-8 border-b bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 ring-4 ring-primary/10">
            <ScrollText className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground text-center">Terms and Conditions for LedgerLM</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="bg-muted px-2 py-0.5 rounded-full font-medium">Version 1.0</span>
            <span>•</span>
            <span>Effective: July 15, 2026</span>
            <span>•</span>
            <span>Issued by BGSW</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[52vh] px-8 py-5 text-sm text-foreground space-y-5">

          <Section icon={<ShieldCheck className="w-4 h-4" />} title="1. Introduction and Acceptance of Terms">
            <p>These Terms and Conditions ("Terms") govern your access to and use of LedgerLM ("Application"), an AI-enabled financial analytics platform developed and operated by BGSW (Bosch Global Software Technologies).</p>
            <BulletList items={[
              'By accessing, registering for, or using the Application, you agree to be fully bound by these Terms. If you do not agree, you must immediately cease use of the Application.',
              'These Terms apply to all users — employees, contractors, interns, and all personnel authorized by BGSW.',
              'These Terms must be read alongside BGSW\'s Data Protection Policy, IT Acceptable Use Policy, and AI Governance Framework.',
            ]} />
          </Section>

          <Section icon={<UserCheck className="w-4 h-4" />} title="2. Eligibility and Access">
            <BulletList items={[
              'The Application is available exclusively to individuals employed by or affiliated with BGSW who have been granted access credentials by the Company.',
              'Access is strictly non-transferable — sharing login credentials or granting access to unauthorized individuals is prohibited.',
              'BGSW may revoke or suspend access at any time, with or without notice, in the event of a suspected breach of these Terms or any Company policy.',
              'You are solely responsible for maintaining the confidentiality of your credentials and for all activity occurring under your account.',
            ]} />
          </Section>

          <Section icon={<ShieldCheck className="w-4 h-4" />} title="3. Permitted Use">
            <p>You are authorized to use the Application exclusively for the following purposes:</p>
            <BulletList items={[
              'Analysing, querying, and interpreting internal BGSW financial data using the AI chat interface.',
              'Generating financial summaries, reports, and insights for internal business decision-making.',
              'Uploading and processing financial documents (PDF, Excel, CSV) related to BGSW business operations.',
              'All use must be in good faith — provide accurate inputs to enable meaningful AI-generated outputs.',
              'Any use outside this scope requires prior written approval from BGSW.',
            ]} />
          </Section>

          <Section icon={<AlertTriangle className="w-4 h-4 text-destructive" />} title="4. Prohibited Use" danger>
            <p className="text-xs text-muted-foreground mb-2">The following actions are strictly prohibited and may result in immediate suspension:</p>
            <BulletList danger items={[
              'Using the Application for personal, commercial, or any non-enterprise purposes.',
              'Reverse-engineering, decompiling, or attempting to extract the underlying AI models or source code.',
              'Probing, testing, or scanning the Application\'s infrastructure or security systems without written BGSW authorization.',
              'Entering confidential third-party PII, sensitive personal data, or information unnecessary for financial analysis.',
              'Attempting to manipulate, bypass, or interfere with AI components, recommendation engines, or content delivery systems.',
              'Distributing outputs, reports, or financial data outside the BGSW enterprise environment without prior written authorization.',
              'Uploading or introducing malicious code, viruses, ransomware, or any disruptive data into the Application.',
              'Bulk extracting or reproducing financial data in a manner that infringes intellectual property rights.',
              'Impersonating another user or providing false information to gain access to financial data.',
            ]} />
          </Section>

          <Section icon={<Brain className="w-4 h-4" />} title="5. AI-Generated Outputs and Limitations">
            <BulletList items={[
              'The Application uses large language model (LLM) technology to generate outputs based on your inputs and underlying financial data.',
              'All AI-generated outputs are for informational purposes only and do not constitute financial, legal, or professional advice.',
              'BGSW does not guarantee the accuracy, completeness, or fitness for purpose of any AI-generated output. You must independently verify all outputs before relying on them for decision-making.',
              'AI systems may produce errors, inconsistencies, or outdated responses. You accept full responsibility for how you apply any output from this Application.',
            ]} />
          </Section>

          <Section icon={<Database className="w-4 h-4" />} title="6. Data Privacy and Security">
            <BulletList items={[
              'BGSW protects User data in accordance with applicable data protection laws and BGSW\'s internal Data Protection Policy.',
              'You must not input personally identifiable information (PII) or sensitive personal data unless expressly authorized under BGSW\'s data handling procedures.',
              'All data processed through the Application is subject to BGSW\'s data governance policies, including data minimisation, retention, and deletion requirements.',
              'Any suspected data breach, unauthorized access, or security incident must be reported immediately to BGSW\'s IT Security Team.',
            ]} />
          </Section>

          <Section icon={<Copyright className="w-4 h-4" />} title="7. Intellectual Property">
            <BulletList items={[
              'All intellectual property rights in the Application — including software, AI models, design, and content — are owned by or licensed exclusively to BGSW.',
              'You are granted a limited, non-exclusive, non-transferable license to use the Application solely for permitted purposes under these Terms.',
              'You must not reproduce, distribute, modify, or create derivative works of any part of the Application without prior written consent from BGSW.',
            ]} />
          </Section>

          <Section icon={<EyeOff className="w-4 h-4" />} title="8. Confidentiality">
            <BulletList items={[
              'All information accessed through the Application must be treated as confidential and proprietary to BGSW.',
              'You must not disclose, share, or distribute any financial data, reports, or outputs to any third party without prior written authorization from BGSW.',
              'Confidentiality obligations survive the termination of your access to the Application.',
            ]} />
          </Section>

          <Section icon={<Server className="w-4 h-4" />} title="9. System Integrity and Security Compliance">
            <BulletList items={[
              'You must comply with all applicable BGSW IT security policies and procedures when accessing the Application.',
              'You must not attempt to circumvent, disable, or interfere with any security features, access controls, or monitoring systems.',
              'The Application may only be accessed through BGSW-authorized devices and approved networks.',
            ]} />
          </Section>

          <Section icon={<Activity className="w-4 h-4" />} title="10. Monitoring and Audit">
            <BulletList items={[
              'BGSW reserves the right to monitor, log, and audit all User activity within the Application for security, compliance, and performance purposes.',
              'By using the Application, you explicitly consent to such monitoring. Any misuse detected may result in disciplinary action, up to and including termination.',
            ]} />
          </Section>

          <Section icon={<Scale className="w-4 h-4" />} title="11. Liability and Indemnification">
            <BulletList items={[
              'To the fullest extent permitted by law, BGSW shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from use of the Application.',
              'BGSW does not warrant that the Application will be error-free, uninterrupted, or free from harmful components.',
              'BGSW\'s total liability shall not exceed the User\'s internal cost allocation for the Application in the preceding three months.',
              'You agree to indemnify and hold harmless BGSW, its officers, employees, and agents from any claims, losses, or damages arising from your breach of these Terms.',
            ]} />
          </Section>

          <Section icon={<RefreshCw className="w-4 h-4" />} title="12. Modifications to the Terms">
            <BulletList items={[
              'BGSW reserves the right to amend these Terms at any time. Material changes will be communicated via the Application interface or to your registered enterprise email.',
              'Continued use of the Application after notification of changes constitutes acceptance of the revised Terms.',
              'The version number and effective date at the top of this document indicate the most current version.',
            ]} />
          </Section>

          <Section icon={<XCircle className="w-4 h-4" />} title="13. Suspension and Termination">
            <p>BGSW may suspend or terminate your access immediately and without prior notice in the following circumstances:</p>
            <BulletList items={[
              'You breach any provision of these Terms or any applicable BGSW policy.',
              'Your employment or affiliation with BGSW is terminated.',
              'BGSW reasonably suspects unauthorized, fraudulent, or abusive use of the Application.',
              'Termination is required by law or applicable regulatory authority.',
            ]} />
            <p className="mt-1.5">Upon termination, you must immediately cease all use of the Application and must not attempt to circumvent access restrictions. Survival clauses remain in effect.</p>
          </Section>

          <Section icon={<Gavel className="w-4 h-4" />} title="14. Governing Law and Dispute Resolution">
            <BulletList items={[
              'These Terms are governed by and construed in accordance with the laws of India. The courts of Bengaluru shall have exclusive jurisdiction.',
              'Disputes shall first be submitted to internal resolution through BGSW\'s HR and Legal departments. Unresolved disputes shall be referred to binding arbitration.',
            ]} />
          </Section>

          <Section icon={<Sparkles className="w-4 h-4" />} title="15. Ethical Use of AI">
            <BulletList items={[
              'You must engage with the Application\'s AI components in a responsible, ethical, and professional manner, consistent with BGSW\'s AI Ethics Guidelines.',
              'You must not attempt to manipulate, deceive, or exploit AI components to generate discriminatory, harmful, misleading, or unlawful outputs.',
              'You are encouraged to report AI-generated outputs that appear inaccurate, biased, or inappropriate using the feedback mechanisms in the Application.',
            ]} />
          </Section>

          <Section icon={<Phone className="w-4 h-4" />} title="16. Contact and Reporting">
            <p>For questions, concerns, or to report issues relating to these Terms or the Application:</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: 'Application Support', value: 'bgsw-assistant.bosch.tech' },
                { label: 'Data Protection Officer', value: 'DPO.India@in.bosch.com' },
                { label: 'IT Security Team', value: 'RBEI.ProVIRT@bcn.bosch.com' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-3 py-1.5">
                  <span className="text-muted-foreground font-medium w-40 shrink-0">{label}:</span>
                  <span className="font-mono text-primary">{value}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<ShieldCheck className="w-4 h-4" />} title="17–18. Severability and Entire Agreement">
            <BulletList items={[
              'If any provision of these Terms is found invalid or unenforceable, it shall be modified to the minimum extent necessary, and the remaining provisions shall continue in full force.',
              'These Terms, together with all applicable BGSW policies referenced herein, constitute the entire agreement between BGSW and you with respect to the use of the Application and supersede all prior agreements.',
            ]} />
          </Section>

        </div>

        {/* Footer: acknowledgement checkbox + button */}
        <div className="px-8 py-5 border-t bg-muted/30 space-y-4">
          {/* Acknowledgement checkbox — interactive in accept mode, read-only in view-only */}
          <label className={`flex items-start gap-3 ${isViewOnly ? 'cursor-default opacity-70' : 'cursor-pointer group'}`}>
            <Checkbox
              id="tnc-acknowledge"
              checked={isViewOnly ? true : acknowledged}
              onCheckedChange={isViewOnly ? undefined : (v) => setAcknowledged(!!v)}
              disabled={isViewOnly}
              className="mt-0.5 shrink-0"
            />
            <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              By accessing or using the LedgerLM Application, I acknowledge that I have read, understood, and agreed to be bound by these Terms and Conditions.
            </span>
          </label>

          <Button
            onClick={handleAccept}
            disabled={!isViewOnly && !acknowledged}
            className="w-full h-11 text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isViewOnly ? 'Close' : 'Accept & Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Section helper
function Section({
  icon,
  title,
  children,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${danger ? 'text-destructive' : 'text-foreground'}`}>
        <span className={`flex items-center justify-center w-6 h-6 rounded-full ${danger ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          {icon}
        </span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="ml-8 space-y-2 text-muted-foreground leading-relaxed text-sm">
        {children}
      </div>
    </div>
  );
}

// Bullet list helper
function BulletList({ items, danger }: { items: string[]; danger?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${danger ? 'bg-destructive/60' : 'bg-primary/50'}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
