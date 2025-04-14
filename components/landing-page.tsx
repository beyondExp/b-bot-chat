"use client"

import { useAuth0 } from "@auth0/auth0-react"
import {
  Sparkles,
  Bot,
  BookOpen,
  ChefHat,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Zap,
  Users,
  Settings,
  DollarSign,
  AppWindow,
  PenTool,
  Share2,
  BarChart3,
  Cpu,
  ExternalLink,
  Download,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { PWAInstallGuide } from "./pwa-install-guide"

export function LandingPage() {
  const { loginWithRedirect, isLoading, error } = useAuth0()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false)
  const [showPWAGuide, setShowPWAGuide] = useState(false)

  const handleLogin = async () => {
    try {
      setIsAttemptingLogin(true)
      await loginWithRedirect({
        appState: {
          returnTo: window.location.pathname,
        },
      })
    } catch (err) {
      console.error("Login error:", err)
      setLoginError("Failed to login. Please try again.")
      setIsAttemptingLogin(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="container mx-auto py-6 px-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 relative flex items-center justify-center">
            <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={40} height={40} className="dark:invert" />
          </div>
          <span className="font-bold text-xl">Beyond-Bot.ai</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#agents" className="text-muted-foreground hover:text-foreground transition-colors">
            Agents
          </a>
          <a href="#hub" className="text-muted-foreground hover:text-foreground transition-colors">
            Creator Hub
          </a>
          <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">
            Benefits
          </a>
        </div>
        <button
          onClick={handleLogin}
          disabled={isLoading || isAttemptingLogin}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          {isLoading || isAttemptingLogin ? (
            <>
              <span>Loading...</span>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto py-16 px-4 flex flex-col lg:flex-row items-center gap-12">
        <div className="lg:w-1/2 space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Chat with Specialized AI Agents for Every Need
          </h1>
          <p className="text-xl text-muted-foreground">
            Beyond-Bot.ai brings you a suite of AI agents with unique personalities and expertise, designed to help with
            specific tasks and knowledge domains.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={handleLogin}
              disabled={isLoading || isAttemptingLogin}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading || isAttemptingLogin ? (
                <>
                  <span>Loading...</span>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </>
              ) : (
                <>
                  <span>Get Started</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <button
              onClick={() => setShowPWAGuide(true)}
              className="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/70 transition-colors flex items-center justify-center gap-2"
            >
              <span>Install App</span>
              <Download size={16} />
            </button>
            <a
              href="#hub"
              className="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/70 transition-colors flex items-center justify-center gap-2"
            >
              <span>Create Your Own Agent</span>
              <PenTool size={16} />
            </a>
          </div>
          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">
              Authentication error. Please try again or contact support.
            </div>
          )}
          {loginError && <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">{loginError}</div>}
        </div>
        <div className="lg:w-1/2 relative">
          <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="border-b border-border p-4 flex items-center gap-3">
              <div className="w-8 h-8 relative rounded-full overflow-hidden bg-primary flex items-center justify-center">
                <Image src="/placeholder.svg?height=32&width=32" alt="Beyond Assistant" width={32} height={32} />
              </div>
              <div>
                <h3 className="font-medium text-sm">Beyond Assistant</h3>
                <p className="text-xs text-muted-foreground">beyond-bot.ai</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-muted p-3 rounded-lg text-sm">
                  Hello! I'm Beyond Assistant. How can I help you today?
                </div>
              </div>
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-black p-3 rounded-lg text-sm text-white">
                  Can you explain quantum computing in simple terms?
                </div>
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-muted p-3 rounded-lg text-sm">
                  Quantum computing uses quantum bits or "qubits" that can exist in multiple states simultaneously,
                  unlike classical bits that are either 0 or 1. This allows quantum computers to process complex
                  problems much faster for certain tasks like cryptography and molecular modeling.
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -z-10 -bottom-6 -right-6 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute -z-10 -top-6 -left-6 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Beyond-Bot.ai offers a comprehensive platform for both users and creators
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Chat with AI Agents</h3>
            <p className="text-muted-foreground">
              Engage with specialized AI agents designed for specific tasks and knowledge domains.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <PenTool size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Create Custom Agents</h3>
            <p className="text-muted-foreground">
              Build your own AI agents with specific personalities, knowledge, and capabilities.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Team Orchestration</h3>
            <p className="text-muted-foreground">
              Organize multiple agents into teams that work together to solve complex problems.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <DollarSign size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Monetize Your Agents</h3>
            <p className="text-muted-foreground">
              Publish your agents to the marketplace and earn money when others use them.
            </p>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="container mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Meet Our Specialized AI Agents</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Each agent has unique expertise and personality to assist you with specific tasks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Agent 1 */}
          <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Beyond Assistant</h3>
                <p className="text-muted-foreground">General purpose AI assistant</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-4">
                A versatile AI assistant that can help with a wide range of tasks, from answering questions to
                generating content.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Zap size={12} />
                  Web Search
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Zap size={12} />
                  Creative Writing
                </span>
              </div>
            </div>
          </div>

          {/* Agent 2 */}
          <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Professor Einstein</h3>
                <p className="text-muted-foreground">Physics and mathematics expert</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-4">
                An expert in physics and mathematics who can explain complex concepts in simple terms and provide
                detailed explanations.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Zap size={12} />
                  Data Analysis
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Zap size={12} />
                  Web Search
                </span>
              </div>
            </div>
          </div>

          {/* Agent 3 */}
          <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ChefHat size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Chef Gordon</h3>
                <p className="text-muted-foreground">Culinary expert and recipe creator</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-4">
                A world-renowned culinary expert who can provide recipes, cooking tips, and food science explanations.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Zap size={12} />
                  Creative Writing
                </span>
              </div>
            </div>
          </div>

          {/* More Agents Teaser */}
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">And Many More...</h3>
                <p className="text-primary/80">Discover all our specialized agents</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-4">
                Explore our growing collection of AI agents with specialized knowledge and capabilities to help with
                your specific needs.
              </p>
              <button
                onClick={handleLogin}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <span>Sign In to Explore</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Hub Section */}
      <section
        id="hub"
        className="container mx-auto py-16 px-4 bg-gradient-to-br from-primary/5 to-background rounded-xl border border-primary/10 my-16"
      >
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2">
            <div className="relative">
              <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <PenTool size={20} className="text-white" />
                  </div>
                  <h3 className="font-bold text-xl">Agent Creator Hub</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Settings size={16} />
                      Agent Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-background p-2 rounded border border-border text-sm">Name: Chef Assistant</div>
                      <div className="bg-background p-2 rounded border border-border text-sm">Category: Cooking</div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Cpu size={16} />
                      Model Fine-tuning
                    </h4>
                    <div className="h-4 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-3/4"></div>
                    </div>
                    <p className="text-xs mt-1 text-muted-foreground">Training progress: 75%</p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AppWindow size={16} />
                      Connected Apps
                    </h4>
                    <div className="flex gap-2">
                      <div className="bg-background p-2 rounded border border-border text-xs flex items-center gap-1">
                        <span>Recipe DB</span>
                        <CheckCircle size={12} className="text-green-500" />
                      </div>
                      <div className="bg-background p-2 rounded border border-border text-xs flex items-center gap-1">
                        <span>Nutrition API</span>
                        <CheckCircle size={12} className="text-green-500" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <DollarSign size={16} />
                      Monetization
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Price per use:</span>
                      <span className="font-medium">$0.05</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Monthly subscription:</span>
                      <span className="font-medium">$4.99</span>
                    </div>
                  </div>

                  <a
                    href="https://hub.b-bot.space"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 size={16} />
                    <span>Go to Creator Hub</span>
                  </a>
                </div>
              </div>
              <div className="absolute -z-10 -bottom-4 -right-4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
            </div>
          </div>

          <div className="lg:w-1/2 space-y-6">
            <h2 className="text-3xl font-bold">Create, Publish & Monetize Your Own AI Agents</h2>
            <p className="text-lg text-muted-foreground">
              The Beyond-Bot.ai Creator Hub is a separate platform that gives you powerful tools to build, train, and
              monetize your own AI agents. Share your expertise with the world and earn money when others use your
              creations.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <PenTool size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Create Custom Agents</h3>
                  <p className="text-muted-foreground">
                    Design AI agents with unique personalities, knowledge bases, and specialized capabilities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Users size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Orchestrate Agent Teams</h3>
                  <p className="text-muted-foreground">
                    Combine multiple agents into teams that work together to solve complex problems.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Cpu size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Fine-tune Models</h3>
                  <p className="text-muted-foreground">
                    Train your agents on specialized data to improve their performance in specific domains.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <AppWindow size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Connect Apps & APIs</h3>
                  <p className="text-muted-foreground">
                    Enhance your agents with external tools, databases, and services for expanded capabilities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <DollarSign size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Earn Money</h3>
                  <p className="text-muted-foreground">
                    Set your own pricing and earn revenue when users interact with your published agents.
                  </p>
                </div>
              </div>
            </div>

            <a
              href="https://hub.b-bot.space"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <span>Visit Creator Hub</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Monetization Section */}
      <section className="container mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Turn Your Expertise Into Income</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create valuable AI agents and earn money when users engage with them
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Share2 size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Publish</h3>
            <p className="text-muted-foreground mb-4">
              Create and publish specialized AI agents in our marketplace. Share your expertise with the world.
            </p>
            <div className="flex items-center justify-between text-sm border-t border-border pt-4">
              <span>Time to publish:</span>
              <span className="font-medium">As little as 1 day</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Grow</h3>
            <p className="text-muted-foreground mb-4">
              Build a following as users discover and engage with your agents. Gain reputation in your field of
              expertise.
            </p>
            <div className="flex items-center justify-between text-sm border-t border-border pt-4">
              <span>Average user growth:</span>
              <span className="font-medium">30% monthly</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <DollarSign size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Earn</h3>
            <p className="text-muted-foreground mb-4">
              Set your own pricing model and earn money every time users interact with your agents.
            </p>
            <div className="flex items-center justify-between text-sm border-t border-border pt-4">
              <span>Top creator earnings:</span>
              <span className="font-medium">$5,000+ monthly</span>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-muted p-8 rounded-xl border border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Ready to monetize your expertise?</h3>
              <p className="text-muted-foreground">Join our creator program and start earning today.</p>
            </div>
            <button
              onClick={handleLogin}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Become a Creator</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Analytics & Insights Section */}
      <section className="container mx-auto py-16 px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2 space-y-6">
            <h2 className="text-3xl font-bold">Track Performance & Optimize Your Agents</h2>
            <p className="text-lg text-muted-foreground">
              Get detailed analytics and insights about how users interact with your agents. Use this data to improve
              performance and increase your earnings.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <BarChart3 size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Usage Analytics</h3>
                  <p className="text-muted-foreground">
                    Track user engagement, conversation length, and popular topics.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <DollarSign size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Revenue Tracking</h3>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    Monitor your earnings, conversion rates, and subscription growth.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <MessageSquare size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">User Feedback</h3>
                  <p className="text-muted-foreground">Collect and analyze user feedback to improve your agents.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <span>Access Analytics</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="lg:w-1/2">
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xl">Agent Performance</h3>
                <div className="text-sm text-muted-foreground">Last 30 days</div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">User Interactions</span>
                    <span className="text-primary font-bold">12,458</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-3/4"></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Revenue Generated</span>
                    <span className="text-primary font-bold">$1,245.80</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-2/3"></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">User Satisfaction</span>
                    <span className="text-primary font-bold">4.8/5.0</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-11/12"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Active Subscribers</div>
                    <div className="text-2xl font-bold">842</div>
                    <div className="text-xs text-green-500 flex items-center gap-1">
                      <ArrowRight className="rotate-45" size={12} />
                      +12% this month
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Avg. Session</div>
                    <div className="text-2xl font-bold">8.5 min</div>
                    <div className="text-xs text-green-500 flex items-center gap-1">
                      <ArrowRight className="rotate-45" size={12} />
                      +3% this month
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="container mx-auto py-16 px-4 bg-card rounded-xl border border-border my-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose Beyond-Bot.ai?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our platform offers unique advantages for both users and creators
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot size={32} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Specialized Agents</h3>
            <p className="text-muted-foreground">
              Access AI agents with deep expertise in specific domains, from science to cooking to mental health.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Zap size={32} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Enhanced Capabilities</h3>
            <p className="text-muted-foreground">
              Our agents come with special abilities like web search, data analysis, and creative writing.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <DollarSign size={32} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Monetization</h3>
            <p className="text-muted-foreground">
              Create and publish your own AI agents and earn money when others use them.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto py-16 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Experience Beyond-Bot.ai?</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Sign in now to start chatting with our specialized AI agents or visit our Creator Hub to build your own.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleLogin}
            disabled={isLoading || isAttemptingLogin}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 text-lg"
          >
            {isLoading || isAttemptingLogin ? (
              <>
                <span>Loading...</span>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </>
            ) : (
              <>
                <span>Chat with AI Agents</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
          <a
            href="https://hub.b-bot.space"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/70 transition-colors inline-flex items-center gap-2 text-lg"
          >
            <span>Visit Creator Hub</span>
            <ExternalLink size={20} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 relative flex items-center justify-center">
                <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={32} height={32} className="dark:invert" />
              </div>
              <span className="font-bold">Beyond-Bot.ai</span>
            </div>
            <div className="flex gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#agents" className="text-muted-foreground hover:text-foreground transition-colors">
                Agents
              </a>
              <a href="#hub" className="text-muted-foreground hover:text-foreground transition-colors">
                Creator Hub
              </a>
              <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">
                Benefits
              </a>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              © {new Date().getFullYear()} Beyond-Bot.ai. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
      {showPWAGuide && <PWAInstallGuide onClose={() => setShowPWAGuide(false)} />}
    </div>
  )
}
