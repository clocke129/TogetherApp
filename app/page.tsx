'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Heart, FileText, Calendar, Users, Lightbulb } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// Content for Help Modals
const helpContent = {
  note: {
    title: "Using the Note Screen",
    content: (
      <>
        <p>The Note screen is designed for quick capture of prayer requests and follow-ups during conversations or reflection.</p>
        <ol className="list-decimal space-y-2 pl-5 mt-3">
          <li><strong>Start Typing:</strong> Simply type your notes in the main text area.</li>
          <li><strong>Tag People:</strong> Type <code>@</code> followed by a name (e.g., <code>@John Doe</code>). If the person exists, they'll be linked. If not, a new person profile will be created when you save.</li>
          <li><strong>Add Prayer Requests:</strong> Any text on the line(s) immediately following an <code>@Name</code> tag will be automatically associated with that person as a prayer request.</li>
          <li><strong>Schedule Follow-ups:</strong> Start the line with a date tag like <code>#MMDD</code> followed by the task description (e.g., <code>#0321 Call Sarah</code>). This creates a follow-up task due March 21st for the most recently mentioned person.</li>
          <li><strong>Live Preview:</strong> The right-hand pane shows how your notes are being structured in real-time.</li>
          <li><strong>Save:</strong> Click the "Save Notes" button to process your input and add the requests/follow-ups to the system.</li>
        </ol>
      </>
    )
  },
  people: {
    title: "Managing People & Groups",
    content: (
       <>
        <p>The People screen (Assignments) is where you manage your contacts and organize them into groups for prayer scheduling.</p>
        <ol className="list-decimal space-y-2 pl-5 mt-3">
          <li><strong>View People:</strong> See a list of all people you've added (e.g., via the Note screen). Click a person to view/edit details, requests, and follow-ups.</li>
          <li><strong>Add/Edit People:</strong> Manually add new people or edit existing details using the respective buttons.</li>
          <li><strong>Create Groups:</strong> Click "Manage Groups" to create new groups (e.g., "Small Group", "Family").</li>
          <li><strong>Assign to Groups:</strong> Add people to the relevant groups. A person can belong to one group.</li>
          <li><strong>Set Prayer Schedules:</strong> Within "Manage Groups", define how often and how many people from that group should appear on your daily prayer list (e.g., "Pray for 2 people from Small Group every Monday, Wednesday, Friday").</li>
        </ol>
      </>
    )
  },
  pray: {
    title: "Using the Pray Screen",
    content: (
      <>
        <p>The Pray screen presents your focused prayer list for the day, based on the schedules you set up.</p>
        <ol className="list-decimal space-y-2 pl-5 mt-3">
          <li><strong>Daily List:</strong> See the people and specific requests assigned for today's date.</li>
          <li><strong>View Details:</strong> Click the arrow on a person's card to expand and see their recent prayer requests and any active follow-ups.</li>
          <li><strong>Mark as Prayed:</strong> Click the 'Pray' button (heart icon) next to a person's name once you have prayed for them. It will change to 'Prayed' (check icon) and move to the 'Completed' tab.</li>
          <li><strong>Track Progress:</strong> Use the 'Active' and 'Completed' tabs to see who you still need to pray for today and who you've already covered.</li>
        </ol>
      </>
    )
  },
  followup: {
    title: "Managing Follow-ups",
    content: (
       <>
        <p>The Follow-up screen helps you track tasks and reminders linked to specific people.</p>
        <ol className="list-decimal space-y-2 pl-5 mt-3">
          <li><strong>Creation:</strong> Follow-ups are primarily created using the <code>#MMDD</code> tag in the Note screen. They can also sometimes be added manually on the People/Assignments screen.</li>
          <li><strong>View Tasks:</strong> See a list of all your follow-up tasks, usually sorted with overdue items first, then by upcoming due date.</li>
          <li><strong>Identify Overdue:</strong> Easily see tasks whose due dates have passed.</li>
          <li><strong>Mark Complete:</strong> Check the box next to a follow-up item when you have completed the task.</li>
        </ol>
      </>
    )
  }
};

type HelpSection = keyof typeof helpContent;

export default function Home() {
  const { user, loading } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ title: string; content: React.ReactNode } | null>(null);

  // Function to open the modal with specific content
  const showHelpModal = (section: HelpSection) => {
    setModalData(helpContent[section]);
    setModalOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <>
      <div className="mobile-container">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to Together!</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A quick guide for managing your prayer requests and follow-ups.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="flex flex-col">
              <CardHeader>
                <Link href="/notes" className="flex items-center gap-2 underline hover:text-shrub">
                  <FileText className="h-6 w-6 text-shrub" />
                  <CardTitle>Note</CardTitle>
                </Link>
                <CardDescription>Quickly capture prayer details and follow-ups.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <code>@Name</code> tags or creates a person. Text on the following line adds a prayer request for that person.
                  </li>
                  <li>
                    <code>#MMDD</code> (e.g., <code>#0315</code> for March 15th) creates a follow-up task for text on that line.
                  </li>
                  <li>
                    Preview pane shows automatic structuring live.
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="p-0 h-auto text-sm text-shrub" onClick={() => showHelpModal('note')}>
                  Learn More
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <Link href="/assignments" className="flex items-center gap-2 underline hover:text-shrub">
                  <Users className="h-6 w-6 text-shrub" />
                  <CardTitle>People</CardTitle>
                </Link>
                <CardDescription>Manage people, groups, and their prayer assignments.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>View and organize all your contacts.</li>
                  <li>Create groups to manage prayer assignments easily.</li>
                  <li>Assign people to groups and set prayer schedules.</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="p-0 h-auto text-sm text-shrub" onClick={() => showHelpModal('people')}>
                  Learn More
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <Link href="/prayer" className="flex items-center gap-2 underline hover:text-shrub">
                  <Heart className="h-6 w-6 text-shrub" />
                  <CardTitle>Pray</CardTitle>
                </Link>
                <CardDescription>View daily prayer list, manage assignments, and track completion.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>See people/requests assigned for today.</li>
                  <li>Use the <span className="font-semibold">Assign Groups</span> button to organize people and set prayer days.</li>
                  <li>Mark items as 'Prayed' to track progress.</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="p-0 h-auto text-sm text-shrub" onClick={() => showHelpModal('pray')}>
                  Learn More
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <Link href="/followups" className="flex items-center gap-2 underline hover:text-shrub">
                  <Calendar className="h-6 w-6 text-shrub" />
                  <CardTitle>Follow-up</CardTitle>
                </Link>
                <CardDescription>Manage upcoming and completed follow-up tasks.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Track follow-up items created from notes (using <code>#MMDD</code>).</li>
                  <li>View upcoming/overdue tasks and set dates.</li>
                  <li>Mark tasks as complete when finished.</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="p-0 h-auto text-sm text-shrub" onClick={() => showHelpModal('followup')}>
                  Learn More
                </Button>
              </CardFooter>
            </Card>
          </div>
          <p className="mt-6 flex justify-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4 text-shrub flex-shrink-0" />
            <span>(Tip: Click the "Together" logo in the top bar anytime to return here)</span>
          </p>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{modalData?.title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none dark:prose-invert py-4">
            {modalData?.content}
          </div>
          <DialogFooter>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

