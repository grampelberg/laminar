use std::collections::HashSet;

use eyre::{Result, eyre};
use laminar_stream::SourceProcess;
use libproc::{
    bsd_info::BSDInfo,
    file_info::{ListFDs, PIDFDInfo, PIDFDInfoFlavor, ProcFDType, pidfdinfo},
    net_info::{ProcFileInfo, VInfoStat},
    proc_pid::{listpidinfo, pidinfo},
    processes::{ProcFilter, pids_by_type},
};

use super::Error;

#[repr(C)]
#[derive(Default)]
struct PipeInfo {
    pipe_stat: VInfoStat,
    pipe_handle: u64,
    pipe_peerhandle: u64,
    pipe_status: i32,
    rfu_1: i32,
}

#[repr(C)]
#[derive(Default)]
struct PipeFDInfo {
    pfi: ProcFileInfo,
    pipeinfo: PipeInfo,
}

impl PartialEq for PipeFDInfo {
    fn eq(&self, other: &Self) -> bool {
        let lhs = [self.pipeinfo.pipe_handle, self.pipeinfo.pipe_peerhandle];
        let rhs = [other.pipeinfo.pipe_handle, other.pipeinfo.pipe_peerhandle];
        lhs.iter().any(|l| rhs.iter().any(|r| l == r))
    }
}

impl PIDFDInfo for PipeFDInfo {
    fn flavor() -> PIDFDInfoFlavor {
        PIDFDInfoFlavor::PipeInfo
    }
}

fn pipe_fds(pid: i32) -> Result<impl Iterator<Item = PipeFDInfo>> {
    let info = pidinfo::<BSDInfo>(pid, 0).map_err(|e| eyre!(e))?;

    Ok(listpidinfo::<ListFDs>(pid, info.pbi_nfiles as usize)
        .map_err(|e| eyre!(e))?
        .into_iter()
        .filter(|fd| {
            matches!(ProcFDType::from(fd.proc_fdtype), ProcFDType::Pipe)
        })
        .filter_map(move |fd| pidfdinfo::<PipeFDInfo>(pid, fd.proc_fd).ok()))
}

pub(super) fn get_sources() -> Result<Option<SourceProcess>, Error> {
    let pid = i32::try_from(std::process::id())
        .map_err(|_| Error::NoSource("pid out of range for i32".to_string()))?;
    let reader =
        pidfdinfo::<PipeFDInfo>(pid, 0).map_err(Error::NoSource)?;

    let all_pids = pids_by_type(ProcFilter::All)
        .map_err(|e| Error::NoSource(e.to_string()))?;

    let sources = all_pids
        .iter()
        .filter_map(|p| i32::try_from(*p).ok())
        .filter(|p| *p != pid)
        .filter_map(|p| {
            if !pipe_fds(p)
                .into_iter()
                .flatten()
                .any(|writer| writer == reader)
            {
                return None;
            }

            Some(SourceProcess::try_from(u32::try_from(p).ok()?))
        })
        .collect::<Result<HashSet<_>, String>>()
        .map_err(Error::NoSource)?
        .into_iter()
        .collect::<Vec<_>>();

    if sources.is_empty() {
        tracing::error!("no source process candidates found");
        return Ok(None);
    }

    if sources.len() > 1 {
        tracing::warn!(
            count = sources.len(),
            "multiple source process candidates found"
        );
    }

    Ok(sources.into_iter().next())
}
