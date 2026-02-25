export const authFormStyles = {
  panel: "flex flex-col justify-center",
  header: "mb-6 space-y-2",
  title: "text-3xl font-light text-[#141414] tracking-tight",
  subtitle: "text-base text-[#666666]",
  section: "space-y-5",
  socialGroup: "space-y-3.5",
  socialButton:
    "w-full h-12 border-gray-200 bg-white hover:bg-gray-50 text-[#141414] hover:!text-[#141414] font-medium text-base",
  dividerWrap: "relative py-2",
  dividerText:
    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[13px] leading-5 font-medium text-[#667085]",
  form: "space-y-4",
  field: "space-y-2",
  label: "text-sm text-[#666666] font-medium",
  fieldIcon:
    "absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]",
  input:
    "pl-11 h-12 bg-gray-50 border-gray-200 text-base text-[#141414] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600 focus-visible:bg-white transition-all",
  auxRow: "flex items-center justify-end -mt-1",
  forgotPassword:
    "text-[13px] leading-5 font-medium text-[#667085] hover:text-[#141414] transition-colors",
  submitButton:
    "w-full h-12 bg-[#059669] hover:bg-[#059669]/90 text-white font-semibold text-base transition-all shadow-sm hover:shadow-md cursor-pointer",
  footer: "pt-0.5 text-sm leading-6 text-center text-[#667085]",
  footerLink: "text-[#141414] hover:underline underline-offset-4 font-semibold",
} as const;
