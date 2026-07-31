"use client"
import { useState } from "react";
import { Switch } from "@headlessui/react";
import {
  CloudArrowUpIcon, VideoCameraIcon, ChatBubbleOvalLeftEllipsisIcon,
  BuildingOfficeIcon, CpuChipIcon, LinkIcon, BoltIcon, Squares2X2Icon, ServerIcon
} from "@heroicons/react/24/solid";

const integrations = [
  { name: "Teams", icon: <ChatBubbleOvalLeftEllipsisIcon className="tw-h-6 tw-w-10 tw-text-indigo-500" />, description: "Streamline software projects, sprints.", enabled: true },
  { name: "Zoom", icon: <VideoCameraIcon className="tw-h-6 tw-w-10 tw-text-blue-500" />, description: "Link pull requests and automate workflows.", enabled: true },
  { name: "Google Meet", icon: <CloudArrowUpIcon className="tw-h-6 tw-w-10 tw-text-green-500" />, description: "Embed file previews in projects.", enabled: true },
  { name: "Hubspot", icon: <BuildingOfficeIcon className="tw-h-6 tw-w-10 tw-text-orange-500" />, description: "Embed Notion pages and notes in projects.", enabled: true },
  { name: "Salesforce", icon: <CpuChipIcon className="tw-h-6 tw-w-10 tw-text-blue-400" />, description: "Plan, track, and release great software.", enabled: false },
  { name: "Dynamics 365", icon: <LinkIcon className="tw-h-6 tw-w-10 tw-text-purple-500" />, description: "Link and automate Zendesk tickets.", enabled: true },
  { name: "Zapier", icon: <BoltIcon className="tw-h-6 tw-w-10 tw-text-yellow-500" />, description: "Build custom automations and integrations with apps.", enabled: false },
  { name: "Slack", icon: <Squares2X2Icon className="tw-h-6 tw-w-10 tw-text-pink-500" />, description: "Send notifications to channels and create projects.", enabled: true },
  { name: "Dropbox", icon: <ServerIcon className="tw-h-6 tw-w-10 tw-text-blue-600" />, description: "Everything you need for work, all in one place.", enabled: true }
];

export default function IntegrationsGrid() {
  const [services, setServices] = useState(integrations);

  const toggleIntegration = (index: number) => {
    setServices((prev) =>
      prev.map((service, i) =>
        i === index ? { ...service, enabled: !service.enabled } : service
      )
    );
  };

  return (
    <div className="tw-min-h-screen tw-font-[system-ui]">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-6">
        <div>
          <h2 className="tw-text-2xl tw-font-semibold tw-text-gray-900">Integrations and Connected Apps</h2>
          <p className="tw-text-gray-500">Supercharge your workflow and connect the tools you use every day.</p>
        </div>
        <button className="tw-px-4 tw-py-2 tw-bg-button tw-text-white tw-rounded-3xl tw-shadow-md hover:tw-bg-indigo-700">
          + Request Integration
        </button>
      </div>

      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6">
        {services.map((service, index) => (
          <div key={index} className="tw-bg-white tw-p-7 tw-shadow tw-rounded-3xl tw-flex tw-items-center tw-justify-between tw-h-45 tw-font-[system-ui]">

            <div className="tw-flex tw-items-center tw-gap-4 tw-w-full">
              <div className="tw-w-full">
                <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
                  <div className="tw-flex tw-items-center">
                    <div className="tw-p-2 tw-bg-gray-100 tw-rounded-full">{service.icon}</div>
                    <h3 className="tw-text-lg tw-font-medium tw-text-gray-900 tw-ml-3">{service.name}</h3>
                  </div>
                  <div className="tw-flex-shrink-0">
                    <Switch
                      checked={service.enabled}
                      onChange={() => toggleIntegration(index)}
                      className={`${service.enabled ? "tw-bg-button" : "tw-bg-gray-300"} tw-relative tw-inline-flex tw-h-6 tw-w-11 tw-items-center tw-rounded-full`}
                    >
                      <span className="tw-sr-only">Enable {service.name}</span>
                      <span className={`${service.enabled ? "tw-translate-x-6" : "tw-translate-x-1"} tw-inline-block tw-h-4 tw-w-4 tw-transform tw-rounded-full tw-bg-white tw-transition`} />
                    </Switch>
                  </div>
                </div>

                <p className="tw-text-sm  tw-mt-2">{service.description}</p>
                <hr className="tw-my-4" />
                <div className="tw-flex tw-justify-end">
                  <a href="#" className="tw-text-button tw-text-sm tw-font-semibold tw-mt-1">View integration</a>
                </div>
              </div>
            </div>


          </div>
        ))}
      </div>
    </div>
  );
}
