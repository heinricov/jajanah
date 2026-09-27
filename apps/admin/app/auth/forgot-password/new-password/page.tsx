import { FormNewPassword } from '@packages/ui/auth/';

const NOTICE =
  'Fitur reset password belum tersedia. Pengaturan ulang kata sandi via email akan menyusul.';

export default function NewPasswordPage() {
  return <FormNewPassword notice={NOTICE} disabled />;
}
