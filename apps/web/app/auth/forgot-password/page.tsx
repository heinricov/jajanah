import { FormForgotPassword } from '@packages/ui/auth/';

const NOTICE =
  'Fitur reset password belum tersedia. Pengaturan ulang kata sandi via email akan menyusul.';

export default function ForgotPasswordPage() {
  return <FormForgotPassword notice={NOTICE} disabled />;
}
