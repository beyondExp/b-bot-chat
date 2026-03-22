"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Chrome, Smartphone, Apple, X } from "lucide-react"
import Image from "next/image"
import { useI18n } from "@/lib/i18n"

interface PWAInstallGuideProps {
  onClose: () => void
}

export function PWAInstallGuide({ onClose }: PWAInstallGuideProps) {
  const [activeTab, setActiveTab] = useState("chrome")
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="font-semibold text-lg">{t("pwa.guide.title")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t("pwa.guide.subtitle")}
          </p>

          <Tabs defaultValue="chrome" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="chrome" className="flex items-center gap-2">
                <Chrome size={16} />
                <span>Chrome</span>
              </TabsTrigger>
              <TabsTrigger value="android" className="flex items-center gap-2">
                <Smartphone size={16} />
                <span>Android</span>
              </TabsTrigger>
              <TabsTrigger value="ios" className="flex items-center gap-2">
                <Apple size={16} />
                <span>iOS</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chrome" className="space-y-4">
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "1")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("pwa.guide.chrome.step1")}
                </p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=100&width=300"
                    alt="Chrome install button"
                    width={300}
                    height={100}
                    className="rounded-md"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "2")}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t("pwa.guide.chrome.step2")}</p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=150&width=300"
                    alt="Chrome install prompt"
                    width={300}
                    height={150}
                    className="rounded-md"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="android" className="space-y-4">
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "1")}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t("pwa.guide.android.step1")}</p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=150&width=200"
                    alt="Android menu button"
                    width={200}
                    height={150}
                    className="rounded-md"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "2")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("pwa.guide.android.step2")}
                </p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=200&width=200"
                    alt="Android add to home screen"
                    width={200}
                    height={200}
                    className="rounded-md"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ios" className="space-y-4">
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "1")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("pwa.guide.ios.step1")}
                </p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=150&width=200"
                    alt="iOS share button"
                    width={200}
                    height={150}
                    className="rounded-md"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-3">
                <h3 className="font-medium mb-2">{t("pwa.guide.step").replace("{n}", "2")}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("pwa.guide.ios.step2")}
                </p>
                <div className="bg-muted rounded-lg p-2 flex justify-center">
                  <Image
                    src="/placeholder.svg?height=200&width=200"
                    alt="iOS add to home screen"
                    width={200}
                    height={200}
                    className="rounded-md"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <button
            onClick={onClose}
            className="w-full mt-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {t("pwa.guide.gotIt")}
          </button>
        </div>
      </div>
    </div>
  )
}
